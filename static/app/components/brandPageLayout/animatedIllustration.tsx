import {useCallback, useEffect, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Container} from '@sentry/scraps/layout';

import {
  ARTWORK_HEIGHT,
  ARTWORK_LAYERS,
  ARTWORK_PLAYBACK_RATE,
  ARTWORK_WIDTH,
} from './artworkLayers';
import {ArtworkSprite} from './artworkSprite';
import {useArtworkActivity} from './useArtworkActivity';

/** Plays the illustrated entrance, then lets each character react to the pointer. */
export function AnimatedIllustration() {
  const surface = useRef<HTMLDivElement>(null);
  const {hasBeenVisible, isActive, reducedMotion} = useArtworkActivity(surface);
  const [loadedAssets, setLoadedAssets] = useState<ReadonlySet<string>>(new Set());
  const [hoveredLayers, setHoveredLayers] = useState<ReadonlySet<string>>(new Set());
  const isReady = loadedAssets.size === ARTWORK_LAYERS.length;

  const onAssetLoad = useCallback((id: string) => {
    setLoadedAssets(previous =>
      previous.has(id) ? previous : new Set(previous).add(id)
    );
  }, []);

  return (
    <Container
      ref={surface}
      position="relative"
      height="100%"
      aria-hidden="true"
      data-test-id="animated-illustration"
      onPointerMove={event => {
        if (event.pointerType === 'touch' || !isActive) {
          return;
        }

        const hovered = new Set(
          Array.from(
            event.currentTarget.querySelectorAll<HTMLImageElement>('[data-artwork-hit]')
          ).flatMap(image => {
            const bounds = image.getBoundingClientRect();
            const id = image.dataset.artworkHit;
            return id &&
              event.clientX >= bounds.left &&
              event.clientX <= bounds.right &&
              event.clientY >= bounds.top &&
              event.clientY <= bounds.bottom
              ? [id]
              : [];
          })
        );

        setHoveredLayers(previous =>
          previous.size === hovered.size && [...hovered].every(id => previous.has(id))
            ? previous
            : hovered
        );
      }}
      onPointerLeave={() => setHoveredLayers(new Set())}
    >
      {hasBeenVisible &&
        ARTWORK_LAYERS.map(layer => (
          <IllustrationLayer
            key={layer.id}
            layer={layer}
            isActive={isActive}
            isHovered={hoveredLayers.has(layer.id)}
            isReady={isReady}
            reducedMotion={reducedMotion}
            onAssetLoad={onAssetLoad}
          />
        ))}
    </Container>
  );
}

interface IllustrationLayerProps {
  isActive: boolean;
  isHovered: boolean;
  isReady: boolean;
  layer: (typeof ARTWORK_LAYERS)[number];
  onAssetLoad: (id: string) => void;
  reducedMotion: boolean;
}

function IllustrationLayer({
  isActive,
  isHovered,
  isReady,
  layer,
  onAssetLoad,
  reducedMotion,
}: IllustrationLayerProps) {
  const [hasEntered, setHasEntered] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const canPlay = hasEntered && !hasFailed && isActive;
  const isPlaying = canPlay && (layer.playback === 'idle' || isHovered);
  const animationPlayState = isPlaying ? 'running' : 'paused';
  const entrance = {
    opacity: 0,
    x: `${((layer.entrance?.x ?? 0) / layer.width) * 100}%`,
    y: `${((layer.entrance?.y ?? 0) / layer.height) * 100}%`,
  };

  useEffect(() => {
    // Activity can preload images before their load handlers become active.
    if (image.current?.complete && image.current.naturalWidth > 0) {
      onAssetLoad(layer.id);
    }
  }, [layer.id, onAssetLoad]);

  return (
    <MotionLayer
      data-artwork-layer={layer.id}
      position="absolute"
      left={`${(layer.x / ARTWORK_WIDTH) * 100}%`}
      top={`${(layer.y / ARTWORK_HEIGHT) * 100}%`}
      width={`${(layer.width / ARTWORK_WIDTH) * 100}%`}
      height={`${(layer.height / ARTWORK_HEIGHT) * 100}%`}
      initial={reducedMotion ? false : entrance}
      animate={
        isReady || reducedMotion ? {opacity: hasFailed ? 0 : 1, x: 0, y: 0} : entrance
      }
      transition={{
        duration: reducedMotion ? 0 : 0.6 / ARTWORK_PLAYBACK_RATE,
        delay: reducedMotion ? 0 : layer.delay / ARTWORK_PLAYBACK_RATE,
        ease: [0.22, 1, 0.36, 1],
      }}
      onAnimationComplete={() => {
        if (isReady) {
          setHasEntered(true);
        }
      }}
      style={{pointerEvents: layer.frames > 1 && !reducedMotion ? 'auto' : 'none'}}
    >
      <Drift
        position="absolute"
        inset="0"
        $x={`${((layer.drift?.x ?? 0) / layer.width) * 100}%`}
        $y={`${((layer.drift?.y ?? 0) / layer.height) * 100}%`}
        style={{
          animationName: layer.drift && !reducedMotion ? undefined : 'none',
          animationPlayState: canPlay && layer.drift ? 'running' : 'paused',
        }}
      >
        <ArtworkSprite
          ref={image}
          src={layer.src}
          data-artwork-hit={layer.frames > 1 ? layer.id : undefined}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => onAssetLoad(layer.id)}
          onError={() => {
            setHasFailed(true);
            onAssetLoad(layer.id);
          }}
          style={{
            animationName:
              layer.frames > 1 && layer.playback !== 'reaction' && !reducedMotion
                ? undefined
                : 'none',
            animationDuration: `${layer.frames / ((layer.fps ?? 4) * ARTWORK_PLAYBACK_RATE)}s`,
            animationTimingFunction: `steps(${layer.frames}, end)`,
            animationPlayState,
            objectPosition:
              layer.playback === 'reaction' && isHovered && isActive
                ? '100% 0%'
                : '0% 0%',
          }}
          $lastFrame={
            layer.frames > 1 ? `${(layer.frames / (layer.frames - 1)) * 100}%` : '0%'
          }
        />
      </Drift>
    </MotionLayer>
  );
}

const MotionLayer = motion.create(Container);

const float = keyframes`
  from { transform: translate(0, 0); }
  to { transform: translate(var(--drift-x), var(--drift-y)); }
`;

const Drift = styled(Container)<{$x: string; $y: string}>`
  --drift-x: ${p => p.$x};
  --drift-y: ${p => p.$y};
  animation: ${float} ${3 / ARTWORK_PLAYBACK_RATE}s ease-in-out infinite alternate;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
