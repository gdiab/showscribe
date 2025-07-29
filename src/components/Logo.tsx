import Image from 'next/image';

export default function Logo() {
  return (
    <div className="flex items-center gap-1.5 md:gap-3">
      {/* Icon - slightly larger to establish brand hierarchy */}
      <Image
        src="/logos/icononly_transparent_nobuffer.png"
        alt="ShowScribe Icon"
        width={64}
        height={64}
        className="h-10 w-auto md:h-12"
      />

      {/* Text Logo - secondary but prominent with responsive sizing */}
      <Image
        src="/logos/textonly_transparent.svg"
        alt="ShowScribe"
        width={300}
        height={48}
        className="w-auto"
        style={{ height: '22px' }}
        // Custom responsive height: 22px mobile, 28px desktop
        onLoad={(e) => {
          const img = e.target as HTMLImageElement;
          const updateHeight = () => {
            img.style.height = window.innerWidth >= 768 ? '28px' : '22px';
          };
          updateHeight();
          window.addEventListener('resize', updateHeight);
        }}
        priority
      />
    </div>
  );
}
