import styled from '@emotion/styled';

const PAPER_CUT_MASK_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="50" height="180" viewBox="0 0 50 180">
    <path fill="white" d="m0 0 50 90-50 90h50V0Z" />
  </svg>
`;

const PAPER_CUT_MASK_URL = `data:image/svg+xml,${encodeURIComponent(PAPER_CUT_MASK_SVG)}`;

interface BrandLayoutArtProps {
  children: React.ReactNode;
  intrinsicHeight: number;
  intrinsicWidth: number;
  rightBleed: number;
}

/**
 * Positions full-height artwork and clips its left edge with a repeating
 * paper-cut mask. Bleed values use the artwork's intrinsic coordinate space.
 */
export function BrandLayoutArt({
  children,
  intrinsicHeight,
  intrinsicWidth,
  rightBleed,
}: BrandLayoutArtProps) {
  return (
    <Artwork
      $aspectRatio={intrinsicWidth / intrinsicHeight}
      $bleedRatio={rightBleed / intrinsicWidth}
    >
      {children}
    </Artwork>
  );
}

const Artwork = styled('div')<{$aspectRatio: number; $bleedRatio: number}>`
  position: absolute;
  user-select: none;
  right: 0;
  aspect-ratio: ${p => p.$aspectRatio};
  height: 100%;
  transform: translateX(${p => p.$bleedRatio * 100}%);
  mask-image: url('${PAPER_CUT_MASK_URL}'), linear-gradient(#fff 0 0);
  mask-position:
    left top,
    50px top;
  mask-size:
    50px 180px,
    calc(100% - 50px) 100%;
  mask-repeat: repeat-y, no-repeat;
`;
