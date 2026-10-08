import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {ARTWORK_PLAYBACK_RATE} from './artworkLayers';

// Static atlases give JavaScript playback control across browsers.
const swapFrame = keyframes`
  from { object-position: 0% 0%; }
  to { object-position: var(--last-frame) 0%; }
`;

export const ArtworkSprite = styled('img')<{$lastFrame: string}>`
  --last-frame: ${p => p.$lastFrame};
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 0% 0%;
  user-select: none;
  animation: ${swapFrame} ${500 / ARTWORK_PLAYBACK_RATE}ms steps(1, end) infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    object-position: 0% 0% !important;
  }
`;
