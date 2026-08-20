import {useState} from 'react';
import styled from '@emotion/styled';

const PAPER_CUT_MASK_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="50" height="180" viewBox="0 0 50 180">
    <path fill="white" d="m0 0 50 90-50 90h50V0Z" />
  </svg>
`;

const PAPER_CUT_MASK_URL = `data:image/svg+xml,${encodeURIComponent(PAPER_CUT_MASK_SVG)}`;

interface BrandLayoutArtProps {
  rightBleed: number;
  src: string;
}

/**
 * Displays full-height artwork with a repeating paper-cut mask along its left edge.
 * `rightBleed` shifts transparent padding in the source image beyond the viewport.
 */
export function BrandLayoutArt({rightBleed, src}: BrandLayoutArtProps) {
  const [loadedImage, setLoadedImage] = useState<{src: string; width: number}>();
  const bleedRatio = loadedImage?.src === src ? rightBleed / loadedImage.width : 0;

  return (
    <Artwork
      src={src}
      alt=""
      draggable={false}
      $bleedRatio={bleedRatio}
      onLoad={event => {
        setLoadedImage({src, width: event.currentTarget.naturalWidth});
      }}
    />
  );
}

const Artwork = styled('img')<{$bleedRatio: number}>`
  position: absolute;
  user-select: none;
  right: 0;
  width: auto;
  max-width: none;
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
