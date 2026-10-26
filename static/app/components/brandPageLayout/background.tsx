import {useRef} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import nebulaImage from 'sentry-images/brandPageLayout/animated/nebula.svg';

import {ARTWORK_PLAYBACK_RATE} from './artworkLayers';
import {DOT_STARS, CROSS_STARS} from './backgroundStars';
import {useArtworkActivity} from './useArtworkActivity';

/** Keeps the nebula filter static while animating the supplied SVG's star shapes. */
export function BrandPageBackground() {
  const surface = useRef<SVGSVGElement>(null);
  const {hasBeenVisible, isActive} = useArtworkActivity(surface);

  return (
    <Background
      ref={surface}
      viewBox="0 0 2048 1152"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      data-test-id="brand-art-background"
    >
      {hasBeenVisible && (
        <g>
          <image href={nebulaImage} width="2048" height="1152" />
          <g fill="white" data-stars="true">
            {DOT_STARS.map((star, index) => (
              <circle
                key={`${star.x}-${star.y}`}
                cx={star.x}
                cy={star.y}
                r={star.radius}
                fillOpacity={star.opacity}
                data-twinkle={star.radius >= 2.5 ? 'true' : undefined}
                style={{
                  animationDelay: `${(-index * 0.37) / ARTWORK_PLAYBACK_RATE}s`,
                  animationDuration: `${(4 + (index % 7) * 0.4) / ARTWORK_PLAYBACK_RATE}s`,
                  animationPlayState: isActive ? 'running' : 'paused',
                }}
              />
            ))}
            {CROSS_STARS.map((path, index) => (
              <path
                key={path}
                d={path}
                data-twinkle="true"
                style={{
                  animationDelay: `${(-index * 0.83) / ARTWORK_PLAYBACK_RATE}s`,
                  animationDuration: `${(5 + (index % 3)) / ARTWORK_PLAYBACK_RATE}s`,
                  animationPlayState: isActive ? 'running' : 'paused',
                }}
              />
            ))}
          </g>
        </g>
      )}
    </Background>
  );
}

const twinkle = keyframes`
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.1); }
`;

const Background = styled('svg')`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #311a54;
  pointer-events: none;

  [data-twinkle] {
    transform-box: fill-box;
    transform-origin: center;
    animation: ${twinkle} ${5 / ARTWORK_PLAYBACK_RATE}s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    [data-twinkle] {
      animation: none;
    }
  }
`;
