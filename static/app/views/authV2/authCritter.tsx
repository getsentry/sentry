import {useRef} from 'react';

import critterImage from 'sentry-images/brandPageLayout/animated/critter.avif';

import {Container} from '@sentry/scraps/layout';

import {ARTWORK_PLAYBACK_RATE} from 'sentry/components/brandPageLayout/artworkLayers';
import {ArtworkSprite} from 'sentry/components/brandPageLayout/artworkSprite';
import {useArtworkActivity} from 'sentry/components/brandPageLayout/useArtworkActivity';

export function AuthCritter() {
  const surface = useRef<HTMLImageElement>(null);
  const {hasBeenVisible, isActive} = useArtworkActivity(surface);

  return (
    <Container
      position="absolute"
      top="calc(100% + 32px)"
      right="0"
      pointerEvents="none"
      width="clamp(140px, 18vw, 200px)"
      style={{aspectRatio: '400 / 503'}}
      aria-hidden="true"
    >
      <ArtworkSprite
        ref={surface}
        src={hasBeenVisible ? critterImage : undefined}
        alt=""
        draggable={false}
        decoding="async"
        data-test-id="auth-critter"
        $lastFrame={`${(4 / 3) * 100}%`}
        style={{
          animationDuration: `${4 / (10 * ARTWORK_PLAYBACK_RATE)}s`,
          animationTimingFunction: 'steps(4, end)',
          animationPlayState: isActive ? 'running' : 'paused',
        }}
      />
    </Container>
  );
}
