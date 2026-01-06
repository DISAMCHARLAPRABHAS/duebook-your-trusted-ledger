import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}

export function OTPInput({ value, onChange, length = 6, disabled }: OTPInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return;

    const newValue = value.split('');
    newValue[index] = char;
    const result = newValue.join('').slice(0, length);
    onChange(result);

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted);
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, index) => (
        <Input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            "w-12 h-14 text-center text-xl font-bold",
            "focus:ring-primary focus:border-primary"
          )}
        />
      ))}
    </div>
  );
}
