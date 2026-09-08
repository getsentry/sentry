import {useEffect, useId, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, useReducedMotion} from 'framer-motion';

const OUTLINE_ANIMATION_DURATION_MS = 400;
const OUTLINE_REVEAL_DELAY_MS = 500;
const ARTWORK_REVEAL_DURATION_SECONDS = 1;
const ARTWORK_REVEAL_EASING = [0.4, 0, 0.2, 1] as const;

interface InteractiveIllustrationProps {
  backgroundSrc: string;
  outlineSrc: string;
  src: string;
  alt?: string;
}

interface TrailBubble {
  center: Point;
  driftX: number;
  driftY: number;
  duration: number;
  id: number;
  path: string;
  rotation: number;
}

interface ActiveTrailBubble extends TrailBubble {
  element: SVGPathElement;
  startedAt: number;
}

interface Point {
  x: number;
  y: number;
}

interface TimedPoint extends Point {
  timestamp: number;
}

interface AutonomousPath {
  amplitude: number;
  duration: number;
  end: Point;
  pauseAfter: number;
  phase: number;
  start: Point;
  waves: number;
}

/**
 * Displays aligned background, outline, and full-art layers. The outline wipes
 * away as the loaded artwork appears, then returns inside interactive bubbles
 * alongside a distressed version of the artwork.
 */
export function InteractiveIllustration({
  alt,
  backgroundSrc,
  outlineSrc,
  src,
}: InteractiveIllustrationProps) {
  return (
    <InteractiveIllustrationContent
      key={JSON.stringify([backgroundSrc, outlineSrc, src])}
      alt={alt}
      backgroundSrc={backgroundSrc}
      outlineSrc={outlineSrc}
      src={src}
    />
  );
}

function InteractiveIllustrationContent({
  alt = '',
  backgroundSrc,
  outlineSrc,
  src,
}: InteractiveIllustrationProps) {
  const [loadedFullArtworkSrc, setLoadedFullArtworkSrc] = useState<string>();
  const [loadedOutlineSrc, setLoadedOutlineSrc] = useState<string>();
  const [finishedOutlineSrc, setFinishedOutlineSrc] = useState<string>();
  const [animatedOutlineSrc, setAnimatedOutlineSrc] = useState<string>();
  const [revealedArtworkSrc, setRevealedArtworkSrc] = useState<string>();
  const [isInteractionVisible, setIsInteractionVisible] = useState(false);
  const bubblePaths = useRef<SVGGElement>(null);
  const interactionSurface = useRef<HTMLDivElement>(null);
  const nextAutonomousPathId = useRef(0);
  const nextBubbleId = useRef(0);
  const pendingPointerSample = useRef<TimedPoint | undefined>(undefined);
  const pointerActive = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const maskId = `brand-art-blob-${useId().replaceAll(':', '')}`;
  const bubblePathsId = `${maskId}-paths`;
  const bubbleRevealMaskId = `${maskId}-reveal`;
  const bubbleHideMaskId = `${maskId}-hide`;
  const neopanFilterId = `${maskId}-neopan`;
  const isFullArtworkLoaded = loadedFullArtworkSrc === src;
  const isOutlineLoaded = loadedOutlineSrc === outlineSrc;
  const isOutlineAnimationComplete = animatedOutlineSrc === outlineSrc;
  const isArtworkReadyToReveal =
    isFullArtworkLoaded && (prefersReducedMotion || isOutlineAnimationComplete);
  const isArtworkRevealComplete = prefersReducedMotion || revealedArtworkSrc === src;

  useEffect(() => {
    if (finishedOutlineSrc !== outlineSrc) {
      return;
    }

    const timeout = window.setTimeout(
      () => setAnimatedOutlineSrc(outlineSrc),
      OUTLINE_REVEAL_DELAY_MS
    );

    return () => window.clearTimeout(timeout);
  }, [finishedOutlineSrc, outlineSrc]);

  useEffect(() => {
    const surface = interactionSurface.current;

    if (!surface) {
      return;
    }

    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      setIsInteractionVisible(
        Boolean(
          entry?.isIntersecting &&
          entry.boundingClientRect.width > 0 &&
          entry.boundingClientRect.height > 0
        )
      );
    });
    observer.observe(surface);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const surface = interactionSurface.current;
    const paths = bubblePaths.current;

    if (
      !isArtworkRevealComplete ||
      !isInteractionVisible ||
      prefersReducedMotion ||
      !surface ||
      !paths
    ) {
      return;
    }

    const animationPaths = paths;
    const animationSurface = surface;
    let activeBubbles: ActiveTrailBubble[] = [];
    let animationFrame: number;
    let autonomousPath: AutonomousPath | undefined;
    let autonomousStartedAt = 0;
    let lastBubblePosition: TimedPoint | undefined;
    let nextAutonomousAt = performance.now() + 800;
    let wasPointerActive = pointerActive.current;

    function appendBubble(bubble: TrailBubble, now: number) {
      const element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      element.setAttribute('d', bubble.path);
      element.setAttribute('opacity', '0.95');
      element.setAttribute('transform', getBubbleTransform(bubble.center, 0, 0, 0, 0.7));
      animationPaths.appendChild(element);
      activeBubbles.push({...bubble, element, startedAt: now});
    }

    function emitTrailBubbles(point: Point, timestamp: number, now: number) {
      const previousPoint = lastBubblePosition;

      if (!previousPoint) {
        lastBubblePosition = {...point, timestamp};
        appendBubble(createTrailBubble(point, nextBubbleId, 0, 0), now);
        return;
      }

      const deltaX = point.x - previousPoint.x;
      const deltaY = point.y - previousPoint.y;
      const distance = Math.hypot(deltaX, deltaY);
      const velocity = distance / Math.max(timestamp - previousPoint.timestamp, 1);
      const speedFactor = getSpeedFactor(velocity);
      const bubbleSpacing = 20 - speedFactor * 7;
      const bubbleCount = Math.min(6, Math.floor(distance / bubbleSpacing));

      if (!bubbleCount) {
        return;
      }

      const direction = Math.atan2(deltaY, deltaX);

      for (let index = 0; index < bubbleCount; index++) {
        const progress = (index + 1) / bubbleCount;
        const bubble = createTrailBubble(
          {
            x: previousPoint.x + deltaX * progress,
            y: previousPoint.y + deltaY * progress,
          },
          nextBubbleId,
          velocity,
          direction
        );
        appendBubble(bubble, now);
      }

      lastBubblePosition = {...point, timestamp};
    }

    function animateBubbles(now: number) {
      activeBubbles = activeBubbles.filter(bubble => {
        const progress = Math.min((now - bubble.startedAt) / (bubble.duration * 1000), 1);

        if (progress === 1) {
          bubble.element.remove();
          return false;
        }

        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const opacity = 0.95 * (1 - easedProgress);
        const scale = 0.7 + easedProgress * 0.45;
        const translateX = bubble.driftX * easedProgress;
        const translateY = bubble.driftY * easedProgress;
        const rotation = bubble.rotation * easedProgress;
        bubble.element.setAttribute('opacity', String(opacity));
        bubble.element.setAttribute(
          'transform',
          getBubbleTransform(bubble.center, translateX, translateY, rotation, scale)
        );

        return true;
      });
    }

    function animate(now: number) {
      const isPointerActive = pointerActive.current;

      if (isPointerActive) {
        if (!wasPointerActive) {
          autonomousPath = undefined;
          lastBubblePosition = undefined;
        }

        const pointerSample = pendingPointerSample.current;
        pendingPointerSample.current = undefined;

        if (pointerSample) {
          emitTrailBubbles(pointerSample, pointerSample.timestamp, now);
        }
      } else {
        if (wasPointerActive) {
          autonomousPath = undefined;
          lastBubblePosition = undefined;
          nextAutonomousAt = now + 800;
        }

        if (!autonomousPath && now >= nextAutonomousAt) {
          const bounds = animationSurface.getBoundingClientRect();
          autonomousPath = makeAutonomousPath(
            bounds.width,
            bounds.height,
            nextAutonomousPathId.current++
          );
          autonomousStartedAt = now;
          lastBubblePosition = undefined;
        }

        if (autonomousPath) {
          const progress = Math.min(
            (now - autonomousStartedAt) / autonomousPath.duration,
            1
          );
          emitTrailBubbles(getAutonomousPathPoint(autonomousPath, progress), now, now);

          if (progress === 1) {
            nextAutonomousAt = now + autonomousPath.pauseAfter;
            autonomousPath = undefined;
            lastBubblePosition = undefined;
          }
        }
      }

      animateBubbles(now);
      wasPointerActive = isPointerActive;
      animationFrame = window.requestAnimationFrame(animate);
    }

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      pendingPointerSample.current = undefined;
      pointerActive.current = false;
      activeBubbles.forEach(bubble => bubble.element.remove());
    };
  }, [isArtworkRevealComplete, isInteractionVisible, prefersReducedMotion]);

  return (
    <Illustration>
      <ArtworkImage src={backgroundSrc} alt="" aria-hidden="true" draggable={false} />
      <ArtworkRevealMask
        initial={false}
        animate={{
          maskPosition:
            prefersReducedMotion || isArtworkReadyToReveal ? '0% 0%' : '0% 100%',
        }}
        transition={{
          delay: 0,
          duration: prefersReducedMotion ? 0 : ARTWORK_REVEAL_DURATION_SECONDS,
          ease: ARTWORK_REVEAL_EASING,
        }}
        onAnimationComplete={() => {
          if (isArtworkReadyToReveal) {
            setRevealedArtworkSrc(src);
          }
        }}
      >
        <MaskDefinitions aria-hidden="true">
          <defs>
            <g id={bubblePathsId} ref={bubblePaths} />
            <mask
              id={bubbleRevealMaskId}
              x="0"
              y="0"
              width="100%"
              height="100%"
              maskUnits="userSpaceOnUse"
              style={{maskType: 'luminance'}}
            >
              <rect width="100%" height="100%" fill="black" />
              <use href={`#${bubblePathsId}`} fill="white" />
            </mask>
            <mask
              id={bubbleHideMaskId}
              x="0"
              y="0"
              width="100%"
              height="100%"
              maskUnits="userSpaceOnUse"
              style={{maskType: 'luminance'}}
            >
              <rect width="100%" height="100%" fill="white" />
              <use href={`#${bubblePathsId}`} fill="black" />
            </mask>
            <filter id={neopanFilterId} colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="
                  0.5 0.44 0.1 0 -0.02
                  0.5 0.44 0.1 0 -0.02
                  0.5 0.44 0.1 0 -0.02
                  0 0 0 1 0
                "
              />
              <feComponentTransfer>
                <feFuncR type="linear" slope="1.5" intercept="-0.2" />
                <feFuncG type="linear" slope="1.5" intercept="-0.2" />
                <feFuncB type="linear" slope="1.5" intercept="-0.2" />
              </feComponentTransfer>
            </filter>
          </defs>
        </MaskDefinitions>
        <BubbleMaskLayer $maskId={bubbleHideMaskId}>
          <ArtworkImage
            key={src}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={() => setLoadedFullArtworkSrc(src)}
          />
        </BubbleMaskLayer>
        {!prefersReducedMotion && (
          <ArtworkEffectClip $artworkSrc={src}>
            <DistressedArtworkLayer $maskId={bubbleRevealMaskId}>
              <DistressedArtwork
                src={src}
                alt=""
                aria-hidden="true"
                draggable={false}
                $filterId={neopanFilterId}
              />
            </DistressedArtworkLayer>
            <BubbleMaskLayer $maskId={bubbleRevealMaskId}>
              <OutlineArtwork
                key={outlineSrc}
                src={outlineSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
            </BubbleMaskLayer>
          </ArtworkEffectClip>
        )}
        <InteractionSurface
          ref={interactionSurface}
          $enabled={!prefersReducedMotion}
          onPointerEnter={event => {
            pointerActive.current = true;
            pendingPointerSample.current = {
              ...getPointerPosition(event),
              timestamp: event.timeStamp,
            };
          }}
          onPointerMove={event => {
            pendingPointerSample.current = {
              ...getPointerPosition(event),
              timestamp: event.timeStamp,
            };
          }}
          onPointerLeave={() => {
            pointerActive.current = false;
            pendingPointerSample.current = undefined;
          }}
        />
      </ArtworkRevealMask>
      <OutlineHideMask
        initial={false}
        animate={{
          maskPosition:
            prefersReducedMotion || isArtworkReadyToReveal ? '0% 0%' : '0% 100%',
        }}
        transition={{
          duration: prefersReducedMotion ? 0 : ARTWORK_REVEAL_DURATION_SECONDS,
          ease: ARTWORK_REVEAL_EASING,
        }}
      >
        {!prefersReducedMotion && (
          <AnimatedOutlineArtwork
            key={outlineSrc}
            src={outlineSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            fetchPriority="high"
            $isPlaying={isOutlineLoaded}
            onLoad={() => setLoadedOutlineSrc(outlineSrc)}
            onAnimationEnd={() => setFinishedOutlineSrc(outlineSrc)}
          />
        )}
      </OutlineHideMask>
    </Illustration>
  );
}

function getPointerPosition(event: React.PointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {x: event.clientX - bounds.left, y: event.clientY - bounds.top};
}

function makeAutonomousPath(width: number, height: number, seed: number) {
  const direction = seed % 4;
  const startAcross = 0.15 + seededVariation(seed * 23 + 1) * 0.7;
  const endAcross = 0.15 + seededVariation(seed * 31 + 2) * 0.7;
  const edgeOffset = 120;
  let start: Point;
  let end: Point;

  if (direction === 0 || direction === 1) {
    start = {
      x: direction === 0 ? -edgeOffset : width + edgeOffset,
      y: height * startAcross,
    };
    end = {
      x: direction === 0 ? width + edgeOffset : -edgeOffset,
      y: height * endAcross,
    };
  } else {
    start = {
      x: width * startAcross,
      y: direction === 2 ? -edgeOffset : height + edgeOffset,
    };
    end = {
      x: width * endAcross,
      y: direction === 2 ? height + edgeOffset : -edgeOffset,
    };
  }

  return {
    amplitude: Math.min(width, height) * (0.12 + seededVariation(seed * 41 + 3) * 0.14),
    duration: 4500 + seededVariation(seed * 47 + 4) * 2500,
    end,
    pauseAfter: 1000 + seededVariation(seed * 53 + 5) * 1800,
    phase: seededVariation(seed * 59 + 6) * Math.PI * 2,
    start,
    waves: 2 + Math.floor(seededVariation(seed * 61 + 7) * 3),
  } satisfies AutonomousPath;
}

function getAutonomousPathPoint(path: AutonomousPath, progress: number) {
  const deltaX = path.end.x - path.start.x;
  const deltaY = path.end.y - path.start.y;
  const pathLength = Math.hypot(deltaX, deltaY);
  const envelope = Math.sin(progress * Math.PI);
  const primaryWave = Math.sin(progress * Math.PI * 2 * path.waves + path.phase);
  const secondaryWave = Math.sin(
    progress * Math.PI * 2 * (path.waves + 1.5) - path.phase
  );
  const offset = (primaryWave + secondaryWave * 0.28) * path.amplitude * envelope;

  return {
    x: path.start.x + deltaX * progress - (deltaY / pathLength) * offset,
    y: path.start.y + deltaY * progress + (deltaX / pathLength) * offset,
  };
}

function createTrailBubble(
  point: Point,
  nextBubbleId: React.RefObject<number>,
  velocity: number,
  direction: number
) {
  const id = nextBubbleId.current++;
  const speedFactor = getSpeedFactor(velocity);
  const size = (76 + ((id * 29) % 88)) * (0.85 + speedFactor * 0.25);
  const width = size * (0.8 + ((id * 7) % 5) / 10) * (1 + speedFactor * 0.5);
  const height = size * (1 - speedFactor * 0.12);
  const jitteredPoint = {
    x: point.x + ((id * 17) % 23) - 11,
    y: point.y + ((id * 13) % 19) - 9,
  };
  const driftAngle = (((id * 137) % 360) * Math.PI) / 180;
  const driftDistance = 10 + ((id * 5) % 22);

  return {
    center: jitteredPoint,
    driftX: Math.cos(driftAngle) * driftDistance,
    driftY: Math.sin(driftAngle) * driftDistance,
    duration: 1.5 + ((id * 11) % 90) / 100 + speedFactor * 0.35,
    id,
    path: makeOrganicBubblePath(jitteredPoint, width, height, id, direction),
    rotation: ((id * 47) % 41) - 20,
  };
}

function getBubbleTransform(
  center: Point,
  translateX: number,
  translateY: number,
  rotation: number,
  scale: number
) {
  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.cos(radians) * scale;
  const sine = Math.sin(radians) * scale;
  const offsetX = center.x + translateX - cosine * center.x + sine * center.y;
  const offsetY = center.y + translateY - sine * center.x - cosine * center.y;

  return `matrix(${cosine} ${sine} ${-sine} ${cosine} ${offsetX} ${offsetY})`;
}

function getSpeedFactor(velocity: number) {
  return Math.min(Math.max((velocity - 0.1) / 0.9, 0), 1);
}

function makeOrganicBubblePath(
  {x, y}: Point,
  width: number,
  height: number,
  seed: number,
  direction: number
) {
  const pointCount = 7 + (seed % 4);
  const points = Array.from({length: pointCount}, (_value, index) => {
    const angle = (index / pointCount) * Math.PI * 2;
    const radius = 0.76 + seededVariation(seed * 17 + index * 29) * 0.34;

    const localX = Math.cos(angle) * (width / 2) * radius;
    const localY = Math.sin(angle) * (height / 2) * radius;

    return {
      x: x + localX * Math.cos(direction) - localY * Math.sin(direction),
      y: y + localX * Math.sin(direction) + localY * Math.cos(direction),
    };
  });

  const curves = points.map((point, index) => {
    const previous = points[(index - 1 + pointCount) % pointCount]!;
    const next = points[(index + 1) % pointCount]!;
    const afterNext = points[(index + 2) % pointCount]!;
    const controlStart = {
      x: point.x + (next.x - previous.x) / 6,
      y: point.y + (next.y - previous.y) / 6,
    };
    const controlEnd = {
      x: next.x - (afterNext.x - point.x) / 6,
      y: next.y - (afterNext.y - point.y) / 6,
    };

    return `C ${controlStart.x} ${controlStart.y}, ${controlEnd.x} ${controlEnd.y}, ${next.x} ${next.y}`;
  });

  return `M ${points[0]!.x} ${points[0]!.y} ${curves.join(' ')} Z`;
}

function seededVariation(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const ArtworkImage = styled('img')`
  display: block;
  user-select: none;
  width: auto;
  max-width: none;
  height: 100%;
  pointer-events: none;
`;

const Illustration = styled('div')`
  position: relative;
  height: 100%;
`;

const OutlineArtwork = styled(ArtworkImage)`
  opacity: 0.6;
`;

const outlinePlayback = keyframes`
  from { opacity: 0.6; }
  to { opacity: 0.6; }
`;

const AnimatedOutlineArtwork = styled(OutlineArtwork)<{$isPlaying: boolean}>`
  animation: ${outlinePlayback} ${OUTLINE_ANIMATION_DURATION_MS}ms linear;
  animation-play-state: ${p => (p.$isPlaying ? 'running' : 'paused')};
`;

const ArtworkRevealMask = styled(motion.div)`
  position: absolute;
  user-select: none;
  inset: 0;
  mask-image: linear-gradient(
    170deg,
    #fff 0%,
    #fff 49%,
    transparent 51%,
    transparent 100%
  );
  mask-position: 0% 100%;
  mask-size: 100% 250%;
  mask-repeat: no-repeat;
`;

const OutlineHideMask = styled(ArtworkRevealMask)`
  pointer-events: none;
  mask-image: linear-gradient(
    170deg,
    transparent 0%,
    transparent 49%,
    #fff 51%,
    #fff 100%
  );
`;

const MaskDefinitions = styled('svg')`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const BubbleMaskLayer = styled('div')<{$maskId: string}>`
  position: absolute;
  inset: 0;
  mask-image: ${p => `url('#${p.$maskId}')`};
`;

const DistressedArtworkLayer = styled(BubbleMaskLayer)`
  isolation: isolate;
`;

const ArtworkEffectClip = styled('div')<{$artworkSrc: string}>`
  position: absolute;
  inset: 0;
  /* Keep effects inside the artwork background or its opaque breakout elements. */
  mask-image:
    linear-gradient(
      to right,
      #fff 0 calc(100% - var(--brand-artwork-right-bleed, 0%)),
      transparent calc(100% - var(--brand-artwork-right-bleed, 0%))
    ),
    url(${p => p.$artworkSrc});
  mask-size: 100% 100%;
  mask-repeat: no-repeat;
  mask-composite: add;
`;

const InteractionSurface = styled('div')<{$enabled: boolean}>`
  position: absolute;
  inset: 0;
  pointer-events: ${p => (p.$enabled ? 'auto' : 'none')};
`;

const DistressedArtwork = styled(ArtworkImage)<{$filterId: string}>`
  filter: ${p => `url('#${p.$filterId}')`};
  opacity: 0.1;
`;
