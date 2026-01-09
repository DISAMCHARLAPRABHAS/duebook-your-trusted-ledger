import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory OTP store (shared with send-otp in production, use database)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// Store OTPs from send-otp function (use Redis/database in production)
declare global {
  var sharedOtpStore: Map<string, { otp: string; expiresAt: number }>;
}

if (!globalThis.sharedOtpStore) {
  globalThis.sharedOtpStore = new Map();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mobile, otp, countryCode = "+91" } = await req.json();

    if (!mobile || !otp) {
      return new Response(
        JSON.stringify({ error: "Mobile and OTP are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullNumber = `${countryCode}${mobile}`;
    const storedData = globalThis.sharedOtpStore.get(fullNumber);

    if (!storedData) {
      return new Response(
        JSON.stringify({ error: "OTP not found. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (Date.now() > storedData.expiresAt) {
      globalThis.sharedOtpStore.delete(fullNumber);
      return new Response(
        JSON.stringify({ error: "OTP expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (storedData.otp !== otp) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OTP verified - clear it
    globalThis.sharedOtpStore.delete(fullNumber);

    // Create or get user using Supabase Admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Generate email from mobile for Supabase auth
    const email = `${mobile}@duebook.app`;
    
    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUsers?.users?.find(u => u.email === email);

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { mobile, phone_verified: true }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = newUser.user;
    }

    // Generate session token for the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (sessionError) {
      console.error("Error generating session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    // Check if mobile exists as customer
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id, name")
      .eq("mobile", mobile)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        userId: user.id,
        hasProfile: !!profile,
        isExistingCustomer: !!existingCustomer,
        customerName: existingCustomer?.name,
        token: sessionData.properties?.hashed_token,
        email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in verify-otp:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
