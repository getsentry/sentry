import {keyframes} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

export interface IndeterminateLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'vibrant' | 'monochrome';
}

const SQUIGGLE_TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E")`;

const crawl = keyframes`
  0% { mask-position: 0 0; -webkit-mask-position: 0 0; }
  100% { mask-position: 16px 0; -webkit-mask-position: 16px 0; }
`;

// Timing modeled on src/sentry/templates/sentry/partial/loader.html
const slide = keyframes`
  0%, 21% { clip-path: inset(0 100% 0 0); }
  21% { animation-timing-function: ease-out; }
  53% { clip-path: inset(0 0 0 0); }
  65% { clip-path: inset(0 0 0 0); animation-timing-function: ease-out; }
  95% { clip-path: inset(0 0 0 100%); }
  95.01%, 100% { clip-path: inset(0 100% 0 0); }
`;

export function IndeterminateLoader({
  variant = 'vibrant',
  ...props
}: IndeterminateLoaderProps) {
  const theme = useTheme();
  const isMonochrome = variant === 'monochrome';

  return (
    <Track
      role="progressbar"
      aria-label="Loading"
      trackColor={isMonochrome ? 'currentColor' : theme.tokens.border.secondary}
      {...props}
    >
      {isMonochrome ? null : (
        <ColorLayer
          color={isMonochrome ? 'currentColor' : theme.tokens.border.accent.vibrant}
        />
      )}
    </Track>
  );
}

const Track = styled('div')<{trackColor: string}>`
  position: relative;
  width: 100%;
  width: calc(round(down, 100% - 4px, 8px) + 4px);
  height: 8px;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: ${p => p.trackColor};
    opacity: ${p => p.trackOpacity};
    mask-image: ${SQUIGGLE_TILE};
    mask-repeat: repeat-x;
    mask-size: 16px 8px;
    -webkit-mask-image: ${SQUIGGLE_TILE};
    -webkit-mask-repeat: repeat-x;
    -webkit-mask-size: 16px 8px;
    animation: ${crawl} 0.4s linear infinite;
  }
`;

const ColorLayer = styled('span')<{color: string}>`
  position: absolute;
  inset: 0;
  background: ${p => p.color};
  mask-image: ${SQUIGGLE_TILE};
  mask-repeat: repeat-x;
  mask-size: 16px 8px;
  -webkit-mask-image: ${SQUIGGLE_TILE};
  -webkit-mask-repeat: repeat-x;
  -webkit-mask-size: 16px 8px;
  animation:
    ${crawl} 0.4s linear infinite,
    ${slide} 2350ms linear infinite;
`;
