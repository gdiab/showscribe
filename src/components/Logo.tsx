'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function Logo() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Function to check current theme
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Check initial theme
    checkTheme();

    // Create observer to watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex items-center gap-4">
      {/* Icon - uses transparent version that works in both themes */}
      <Image
        src="/logos/icononly_transparent_nobuffer.png"
        alt="ShowScribe Icon"
        width={64}
        height={64}
        className="h-16 w-auto"
      />

      {/* Text Logo - optimized for both light and dark themes */}
      <div className="relative">
        {isDarkMode ? (
          // In dark mode, use the original with invert filter (keeps current good appearance)
          <Image
            src="/logos/textonly_nobuffer.png"
            alt="ShowScribe"
            width={300}
            height={48}
            className="h-8 w-auto brightness-0 invert"
            priority
          />
        ) : (
          // In light mode, use grayscale version for better contrast
          <Image
            src="/logos/grayscale_nobuffer.png"
            alt="ShowScribe"
            width={300}
            height={48}
            className="h-8 w-auto"
            priority
          />
        )}
      </div>
    </div>
  );
}
