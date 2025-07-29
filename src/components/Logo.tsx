import Image from 'next/image';

export default function Logo() {
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

      {/* Text Logo - purple text with transparent background works in both themes */}
      <Image
        src="/logos/textonly_transparent_nobuffer.png"
        alt="ShowScribe"
        width={300}
        height={48}
        className="h-8 w-auto"
        priority
      />
    </div>
  );
}
