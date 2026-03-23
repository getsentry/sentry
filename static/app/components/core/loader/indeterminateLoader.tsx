import type {Keyframes} from '@emotion/react';
import {keyframes} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

export interface IndeterminateLoaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const SQUIGGLE_TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E")`;

const SQUIGGLE_TILE_DASHED = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' stroke-dasharray='3 5' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E")`;

const crawl = keyframes`
  0% { mask-position: 0 0; -webkit-mask-position: 0 0; }
  100% { mask-position: 16px 0; -webkit-mask-position: 16px 0; }
`;

// Timing modeled on src/sentry/templates/sentry/partial/loader.html
// Each color has a solid fill and a dashed trail that enters ~3% earlier.
// Pink enters first, green second, purple last — all ease-out.
// Purple does the final wipe right to reset to gray.

const pinkTrail = keyframes`
  0%, 1% { clip-path: inset(0 100% 0 0); }
  1% { animation-timing-function: ease-out; }
  40% { clip-path: inset(0 0 0 0); }
  60% { clip-path: inset(0 0 0 0); }
  60.01%, 100% { clip-path: inset(0 100% 0 0); }
`;

const pinkSlide = keyframes`
  0%, 4% { clip-path: inset(0 100% 0 0); }
  4% { animation-timing-function: ease-out; }
  43% { clip-path: inset(0 0 0 0); }
  60% { clip-path: inset(0 0 0 0); }
  60.01%, 100% { clip-path: inset(0 100% 0 0); }
`;

const greenTrail = keyframes`
  0%, 9% { clip-path: inset(0 100% 0 0); }
  9% { animation-timing-function: ease-out; }
  44% { clip-path: inset(0 0 0 0); }
  60% { clip-path: inset(0 0 0 0); }
  60.01%, 100% { clip-path: inset(0 100% 0 0); }
`;

const greenSlide = keyframes`
  0%, 12% { clip-path: inset(0 100% 0 0); }
  12% { animation-timing-function: ease-out; }
  47% { clip-path: inset(0 0 0 0); }
  60% { clip-path: inset(0 0 0 0); }
  60.01%, 100% { clip-path: inset(0 100% 0 0); }
`;

const purpleTrail = keyframes`
  0%, 18% { clip-path: inset(0 100% 0 0); }
  18% { animation-timing-function: ease-out; }
  50% { clip-path: inset(0 0 0 0); }
  68% { clip-path: inset(0 0 0 0); animation-timing-function: ease-out; }
  97% { clip-path: inset(0 0 0 100%); }
  97.01%, 100% { clip-path: inset(0 100% 0 0); }
`;

const purpleSlide = keyframes`
  0%, 21% { clip-path: inset(0 100% 0 0); }
  21% { animation-timing-function: ease-out; }
  53% { clip-path: inset(0 0 0 0); }
  65% { clip-path: inset(0 0 0 0); animation-timing-function: ease-out; }
  95% { clip-path: inset(0 0 0 100%); }
  95.01%, 100% { clip-path: inset(0 100% 0 0); }
`;

export function IndeterminateLoader(props: IndeterminateLoaderProps) {
  const theme = useTheme();
  return (
    <Track role="progressbar" aria-label="Loading" {...props}>
      <ColorLayer
        color={theme.tokens.border.promotion.vibrant}
        slide={pinkTrail}
        dashed
      />
      <ColorLayer color={theme.tokens.border.promotion.vibrant} slide={pinkSlide} />
      <ColorLayer color={theme.tokens.border.success.vibrant} slide={greenTrail} dashed />
      <ColorLayer color={theme.tokens.border.success.vibrant} slide={greenSlide} />
      <ColorLayer color={theme.tokens.border.accent.vibrant} slide={purpleTrail} dashed />
      <ColorLayer color={theme.tokens.border.accent.vibrant} slide={purpleSlide} />
    </Track>
  );
}

/* eslint-disable @sentry/scraps/use-semantic-token */
const Track = styled('div')`
  position: relative;
  width: calc(round(down, 100% - 8px, 16px) + 8px);
  height: 8px;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: ${p => p.theme.tokens.border.secondary};
    mask-image: ${SQUIGGLE_TILE};
    mask-repeat: repeat-x;
    mask-size: 16px 8px;
    -webkit-mask-image: ${SQUIGGLE_TILE};
    -webkit-mask-repeat: repeat-x;
    -webkit-mask-size: 16px 8px;
    animation: ${crawl} 0.4s linear infinite;
  }
`;

const ColorLayer = styled('span')<{color: string; slide: Keyframes; dashed?: boolean}>`
  position: absolute;
  inset: 0;
  background: ${p => p.color};
  mask-image: ${p => (p.dashed ? SQUIGGLE_TILE_DASHED : SQUIGGLE_TILE)};
  mask-repeat: repeat-x;
  mask-size: 16px 8px;
  -webkit-mask-image: ${p => (p.dashed ? SQUIGGLE_TILE_DASHED : SQUIGGLE_TILE)};
  -webkit-mask-repeat: repeat-x;
  -webkit-mask-size: 16px 8px;
  animation:
    ${crawl} 0.4s linear infinite,
    ${p => p.slide} 2350ms linear infinite;
`;
