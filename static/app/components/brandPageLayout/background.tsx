import styled from '@emotion/styled';

import noiseTexture from 'sentry-images/brandPageLayout/noise.png';
import spaceStrokes from 'sentry-images/brandPageLayout/space-strokes.avif';

/** Provides the textured purple background used behind branded page artwork. */
export const BrandPageBackground = styled('div')`
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #27065d url(${spaceStrokes}) no-repeat left center;
  background-size: 100% auto;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 65% 80% at 75% 20%, #562291, transparent 67%);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.25;
    mix-blend-mode: soft-light;
    background: #fff url(${noiseTexture}) repeat;
    background-size: 256px 256px;
  }
`;
