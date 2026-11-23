import {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {retryableImport} from 'sentry/utils/retryableImport';

const BugArt = lazy(() => retryableImport(() => import('./bugArt')));

const HOVER_DELAY = 3.5;
const POP = 1;
const at = (offset: number) => `${(HOVER_DELAY + offset).toFixed(2)}s`;

const SCALE = 0.6;
const VIEW_BOX = {x: -95, y: -145, width: 190, height: 180};
const LEDGE = -VIEW_BOX.y * SCALE;
const BELOW_LEDGE = (VIEW_BOX.height + VIEW_BOX.y) * SCALE;
// md and sm buttons lift their face 3px above the button's box while hovered.
const FACE_LIFT = 3;
const CLAW_REACH = 28;
const FINE_HOVER = '(hover: hover) and (pointer: fine)';

const BUGS = [
  {center: 1, hidden: 120, antennae: 86},
  {center: -7.5, hidden: 136, antennae: 102},
  {center: -11.5, hidden: 137, antennae: 103},
] as const;

let lastShownBug: number | undefined;

function pickAnotherBug(previous: number | undefined) {
  const pick = Math.floor(
    Math.random() * (BUGS.length - (previous === undefined ? 0 : 1))
  );
  return previous === undefined ? pick : (previous + 1 + pick) % BUGS.length;
}

interface PeekingBugProps {
  children: React.ReactNode;
}

export function PeekingBug({children}: PeekingBugProps) {
  const [bug, setBug] = useState(() => pickAnotherBug(lastShownBug));
  const [hasHovered, setHasHovered] = useState(false);
  const hideoutRef = useRef<HTMLDivElement>(null);
  const removeEscapeListener = useRef<() => void>(undefined);

  useEffect(() => () => removeEscapeListener.current?.(), []);

  return (
    <Hideout
      ref={hideoutRef}
      data-test-id="peeking-bug"
      display="inline-flex"
      direction="column"
      position="relative"
      onPointerEnter={() => {
        const hideout = hideoutRef.current;
        if (!hideout || !window.matchMedia(FINE_HOVER).matches) {
          return;
        }

        const nextBug = hasHovered ? pickAnotherBug(bug) : bug;
        lastShownBug = nextBug;

        // Snaps any duck in flight to the new bug's hidden pose, or the rise starts mid-air.
        hideout.setAttribute('data-resting', '');
        flushSync(() => {
          setBug(nextBug);
          setHasHovered(true);
        });
        hideout.getBoundingClientRect();
        hideout.removeAttribute('data-resting');
        removeEscapeListener.current?.();

        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            hideout.setAttribute('data-dismissed', '');
          }
        };
        window.addEventListener('keydown', onKeyDown);
        removeEscapeListener.current = () =>
          window.removeEventListener('keydown', onKeyDown);
      }}
      onPointerLeave={() => {
        removeEscapeListener.current?.();
        hideoutRef.current?.removeAttribute('data-dismissed');
      }}
    >
      {children}
      <ErrorBoundary customComponent={null}>
        <BugLayer side="back" bug={bug} hasHovered={hasHovered} />
        <BugLayer side="front" bug={bug} hasHovered={hasHovered} />
      </ErrorBoundary>
    </Hideout>
  );
}

interface BugLayerProps {
  bug: number;
  hasHovered: boolean;
  side: 'back' | 'front';
}

function BugLayer({bug, hasHovered, side}: BugLayerProps) {
  const {center, hidden, antennae} = BUGS[bug]!;
  const style = {
    '--center': center,
    '--hidden': hidden,
    '--antennae': antennae,
  } as React.CSSProperties;

  return (
    <Layer
      className={`layer ${side}`}
      viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      style={style}
      aria-hidden
      focusable="false"
    >
      <g className="rise1">
        <g className="rise2">
          <g className="squash">
            {hasHovered && (
              <Suspense fallback={null}>
                <BugArt index={bug} />
              </Suspense>
            )}
          </g>
        </g>
      </g>
    </Layer>
  );
}

const sniff = keyframes`
  0%, 100% { transform: none; }
  15% { transform: rotate(-12deg); }
  35% { transform: rotate(9deg); }
  55% { transform: rotate(-7deg); }
  75% { transform: rotate(4deg); }
`;

const settle = keyframes`
  0% { transform: none; animation-timing-function: ease-out; }
  22% { transform: scale(1.035, 0.955); animation-timing-function: ease-in-out; }
  48% { transform: scale(0.985, 1.025); animation-timing-function: ease-in-out; }
  72% { transform: scale(1.006, 0.994); animation-timing-function: ease-in-out; }
  100% { transform: none; }
`;

const boing = keyframes`
  0%, 100% { transform: none; }
  12% { transform: rotate(-16deg); }
  32% { transform: rotate(11deg); }
  52% { transform: rotate(-6deg); }
  72% { transform: rotate(3deg); }
  88% { transform: rotate(-1deg); }
`;

const breathe = keyframes`
  from { transform: none; }
  to { transform: scale(1.004, 1.01); }
`;

const sway = keyframes`
  0% { transform: none; animation-timing-function: ease-out; }
  25% { transform: rotate(-3deg); animation-timing-function: ease-in-out; }
  75% { transform: rotate(4deg); animation-timing-function: ease-in; }
  100% { transform: none; }
`;

const Layer = styled('svg')`
  position: absolute;
  top: -${FACE_LIFT + LEDGE}px;
  left: 0;
  width: ${VIEW_BOX.width * SCALE}px;
  height: ${VIEW_BOX.height * SCALE}px;
  pointer-events: none;
  visibility: hidden;
  color: ${p => p.theme.tokens.content.primary};
  /* The art's black outline vanishes on dark backgrounds without a light rim. */
  filter: ${p =>
    p.theme.type === 'dark'
      ? 'drop-shadow(0 0 0.6px currentColor) drop-shadow(0 0 0.6px currentColor)'
      : 'none'};
  transition:
    visibility 0s 0.2s,
    translate ${p => p.theme.motion.snap.fast};

  &.back {
    z-index: -1;
    clip-path: inset(0 0 ${BELOW_LEDGE}px 0);
  }
  /* The button label sits at z-index 1, and the claws hang over it. */
  &.front {
    z-index: 2;
    clip-path: inset(${LEDGE}px 0 ${BELOW_LEDGE}px 0);
    transition:
      visibility 0s 0.2s,
      clip-path 0s 0.1s,
      translate ${p => p.theme.motion.snap.fast};
  }
  &.front .squash {
    translate: 0 -${CLAW_REACH}px;
    transition: translate 0.1s ease-in;
  }

  .rise1 {
    transform: translateY(calc((var(--hidden) - var(--antennae)) * 1px));
  }
  .rise2 {
    transform: translateY(calc(var(--antennae) * 1px));
  }
  .rise1,
  .rise2 {
    transition: transform 0.2s cubic-bezier(0.55, 0, 0.9, 0.45);
  }
  .squash {
    transform-origin: calc(var(--center) * 1px) 0;
  }
`;

const Hideout = styled(Flex)`
  z-index: 0;
  transition: z-index 0s 0.2s;

  &:active .layer {
    translate: 0 ${FACE_LIFT}px;
  }

  &[data-resting] .layer,
  &[data-resting] .rise1,
  &[data-resting] .rise2,
  &[data-resting] .squash {
    transition: none !important;
  }

  @media (forced-colors: active) {
    .layer {
      display: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(
        [data-resting],
        [data-dismissed],
        :has(:disabled, [aria-disabled='true'], [aria-busy='true'])
      ) {
      /* Lifts the bug above neighbouring button labels and code, which sit at z-index 1. */
      z-index: 1;
      transition: none;

      .layer {
        visibility: visible;
        transition:
          visibility 0s ${at(0)},
          translate ${p => p.theme.motion.snap.fast};
      }
      .layer.front {
        clip-path: inset(${LEDGE}px 0 0 0);
        transition:
          visibility 0s ${at(0)},
          clip-path 0s ${at(POP + 0.24)},
          translate ${p => p.theme.motion.snap.fast};
      }
      .layer.front .squash {
        translate: none;
        transition: translate 0.35s cubic-bezier(0.4, 0, 0.2, 1) ${at(POP + 0.24)};
      }

      /* Outranks the global reduced-motion reset, which zeroes every transition delay. */
      @media (prefers-reduced-motion: reduce) {
        .layer {
          transition-delay: ${at(0)}, 0s !important;
        }
        .layer.front {
          transition-delay: ${at(0)}, 0s, 0s !important;
        }
      }

      .rise1 {
        transform: none;
        transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) ${at(0)};
      }
      .rise2 {
        transform: none;
        transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) ${at(POP)};
      }

      .squash {
        animation:
          ${settle} 0.7s ${at(POP + 0.32)},
          ${breathe} 1.6s ease-in-out ${at(POP + 1.1)} infinite alternate;
      }
      .antenna {
        animation:
          ${sniff} 0.6s ease-in-out calc(${at(0.3)} + var(--side) * 0.08s),
          ${boing} 0.85s ease-out calc(${at(POP + 0.4)} + var(--side) * 0.05s),
          ${sway} 4.8s calc(${at(POP + 1.3)} + var(--side) * 0.9s) infinite;
      }
    }
  }
`;
