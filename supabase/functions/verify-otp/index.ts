import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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

    // Validate input format
    if (typeof mobile !== 'string' || mobile.length < 10 || mobile.length > 15 || !/^\d+$/.test(mobile)) {
      return new Response(
        JSON.stringify({ error: "Invalid mobile number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof otp !== 'string' || otp.length !== 6 || !/^\d+$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullNumber = `${countryCode}${mobile}`;
    console.log(`Verifying OTP for ${fullNumber}`);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check rate limiting - get attempt record
    const { data: attemptRecord, error: attemptError } = await supabaseAdmin
      .from("otp_attempts")
      .select("*")
      .eq("mobile", fullNumber)
      .maybeSingle();

    if (attemptError) {
      console.error("Error checking attempts:", attemptError);
    }

    // Check if account is locked
    if (attemptRecord?.locked_until) {
      const lockExpiry = new Date(attemptRecord.locked_until);
      if (new Date() < lockExpiry) {
        const remainingMinutes = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000);
        return new Response(
          JSON.stringify({ 
            error: `Too many failed attempts. Please try again in ${remainingMinutes} minute(s).` 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Lock expired, reset attempts
        await supabaseAdmin
          .from("otp_attempts")
          .update({ attempts: 0, locked_until: null, last_attempt: new Date().toISOString() })
          .eq("mobile", fullNumber);
      }
    }

    // Check if max attempts reached
    if (attemptRecord && attemptRecord.attempts >= MAX_ATTEMPTS) {
      // Lock the account
      const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("otp_attempts")
        .update({ locked_until: lockUntil })
        .eq("mobile", fullNumber);
      
      return new Response(
        JSON.stringify({ 
          error: `Too many failed attempts. Please try again in ${LOCKOUT_MINUTES} minutes.` 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the latest OTP for this number
    const { data: otpData, error: fetchError } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("mobile", fullNumber)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching OTP:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to verify OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpData) {
      console.log(`No OTP found for ${fullNumber}`);
      return new Response(
        JSON.stringify({ error: "OTP not found. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date() > new Date(otpData.expires_at)) {
      // Delete expired OTP
      await supabaseAdmin
        .from("otp_verifications")
        .delete()
        .eq("id", otpData.id);
      
      return new Response(
        JSON.stringify({ error: "OTP expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify OTP - increment attempt counter BEFORE checking
    if (otpData.otp !== otp) {
      // Increment failed attempts
      await supabaseAdmin
        .from("otp_attempts")
        .upsert({ 
          mobile: fullNumber, 
          attempts: (attemptRecord?.attempts || 0) + 1,
          last_attempt: new Date().toISOString()
        }, { onConflict: "mobile" });

      const remainingAttempts = MAX_ATTEMPTS - (attemptRecord?.attempts || 0) - 1;
      return new Response(
        JSON.stringify({ 
          error: `Invalid OTP. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining.` : 'Account will be locked.'}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OTP verified successfully - clear attempt record and delete OTP
    await Promise.all([
      supabaseAdmin
        .from("otp_verifications")
        .delete()
        .eq("id", otpData.id),
      supabaseAdmin
        .from("otp_attempts")
        .delete()
        .eq("mobile", fullNumber)
    ]);

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

    // Check if user has profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    // Check if user has role
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    // Check if mobile exists as customer
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id, name")
      .eq("mobile", mobile)
      .maybeSingle();

    // If existing customer without profile, auto-create profile and role
    if (!profile && existingCustomer) {
      await supabaseAdmin
        .from("profiles")
        .insert({ id: user.id, mobile, full_name: existingCustomer.name });
      
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: user.id, role: 'customer' });

      return new Response(
        JSON.stringify({
          success: true,
          userId: user.id,
          hasProfile: true,
          role: 'customer',
          email,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: user.id,
        hasProfile: !!profile,
        role: userRole?.role || null,
        isExistingCustomer: !!existingCustomer,
        customerName: existingCustomer?.name,
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