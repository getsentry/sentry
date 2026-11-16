import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

const HOVER_DELAY = 3.5;
const at = (offset: number) => `${(HOVER_DELAY + offset).toFixed(2)}s`;

const INK = '#1b0f26';
const PINK = '#ff4fb0';
const LIME = '#9ae63a';
const ORANGE = '#ff9a2e';

const shapeProps = {
  stroke: INK,
  strokeWidth: 3.2,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

interface PeekingBugProps {
  children: React.ReactNode;
}

export function PeekingBug({children}: PeekingBugProps) {
  return (
    <Hideout position="relative">
      {children}
      <Layer className="layer back" viewBox="0 -40 140 180" aria-hidden focusable="false">
        <g className="rise1">
          <g className="rise2">
            <g className="rise3">
              <g className="squash">
                <g className="leg-l">
                  <polygon
                    points="46,80 14,92 30,94 18,108 48,96"
                    fill={PINK}
                    {...shapeProps}
                  />
                </g>
                <g className="leg-r">
                  <polygon
                    points="98,80 130,92 114,94 126,108 96,96"
                    fill={PINK}
                    {...shapeProps}
                  />
                </g>
                <polygon points="98,64 118,56 104,78" fill={PINK} {...shapeProps} />
                <g className="ant-l">
                  <Antenna points="62,50 54,34 63,34 54,17 65,17 58,0" />
                </g>
                <g className="ant-r">
                  <Antenna points="80,48 89,34 82,32 97,20 90,17 108,6" />
                </g>
                <polygon
                  points="40,64 52,48 82,46 98,58 102,84 92,104 70,109 48,105 38,88"
                  fill={PINK}
                  {...shapeProps}
                />
                <g className="eye-l">
                  <polygon
                    points="44,51 64,49 77,59 77,80 66,90 47,90 37,81 37,62"
                    fill={LIME}
                    {...shapeProps}
                  />
                  <g className="pupil">
                    <rect x="51" y="58" width="10" height="24" rx="2.5" fill={INK} />
                    <circle cx="54.4" cy="62.2" r="2.2" fill="#fff" />
                  </g>
                </g>
                <g className="eye-r">
                  <polygon
                    points="81,44 95,43 103,51 102,66 94,72 82,71 76,63 76,50"
                    fill={LIME}
                    {...shapeProps}
                  />
                  <g className="pupil">
                    <rect x="86" y="49.5" width="7" height="16" rx="1.8" fill={INK} />
                    <circle cx="88.4" cy="52.6" r="1.6" fill="#fff" />
                  </g>
                </g>
                <path
                  d="M52 96 l3.4 4.4 l3.4 -4.4 l3.4 4.4 l3.4 -4.4"
                  fill="none"
                  {...shapeProps}
                  strokeWidth={2.4}
                />
                <polygon
                  points="74,90 88,92 81,97 91,102 74,105 79,97"
                  fill={ORANGE}
                  {...shapeProps}
                />
              </g>
            </g>
          </g>
        </g>
      </Layer>
      <Layer
        className="layer front"
        viewBox="0 -40 140 180"
        aria-hidden
        focusable="false"
      >
        <g className="claws-l">
          <g className="reach">
            <g className="slam">
              <g className="tap tap-0">
                <polygon
                  points="50,100 30,106 36,110 22,130 44,114 40,110 56,106"
                  fill={PINK}
                  {...shapeProps}
                />
              </g>
              <g className="tap tap-1">
                <polygon
                  points="62,102 52,110 57,113 50,132 64,114 60,111 70,106"
                  fill={PINK}
                  {...shapeProps}
                />
              </g>
            </g>
          </g>
        </g>
        <g className="claws-r">
          <g className="reach">
            <g className="slam">
              <g className="tap tap-2">
                <polygon
                  points="82,102 92,110 87,113 94,132 80,114 84,111 74,106"
                  fill={PINK}
                  {...shapeProps}
                />
              </g>
              <g className="tap tap-3">
                <polygon
                  points="94,100 114,106 108,110 122,130 100,114 104,110 88,106"
                  fill={PINK}
                  {...shapeProps}
                />
              </g>
            </g>
          </g>
        </g>
      </Layer>
    </Hideout>
  );
}

function Antenna({points}: {points: string}) {
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <polyline points={points} stroke={INK} strokeWidth={7} />
      <polyline points={points} stroke={PINK} strokeWidth={3.4} />
    </g>
  );
}

const sniff = keyframes`
  0%, 100% { transform: none; }
  15% { transform: rotate(-14deg); }
  35% { transform: rotate(10deg); }
  55% { transform: rotate(-9deg); }
  75% { transform: rotate(5deg); }
`;

const boing = keyframes`
  0%, 100% { transform: none; }
  12% { transform: rotate(-20deg); }
  32% { transform: rotate(14deg); }
  52% { transform: rotate(-8deg); }
  72% { transform: rotate(4deg); }
  88% { transform: rotate(-1.5deg); }
`;

const sway = keyframes`
  from { transform: rotate(-4deg); }
  to { transform: rotate(5deg); }
`;

const look = keyframes`
  0%, 100% { transform: none; }
  12%, 42% { transform: translateX(-4px); }
  56%, 86% { transform: translateX(3.5px); }
`;

const glance = keyframes`
  0%, 62%, 100% { transform: none; }
  66%, 84% { transform: translate(1px, 3.5px); }
`;

const blinkTwice = keyframes`
  0%, 22%, 44%, 100% { transform: none; }
  11%, 33% { transform: scaleY(0.08); }
`;

const blink = keyframes`
  0%, 93%, 100% { transform: none; }
  96.5% { transform: scaleY(0.08); }
`;

const hop = keyframes`
  0% { transform: none; animation-timing-function: ease-out; }
  17% { transform: translateY(4px) scale(1.08, 0.9); animation-timing-function: ease-in; }
  28% { transform: translateY(-6px) scale(0.9, 1.16); animation-timing-function: ease-out; }
  44% { transform: translateY(-14px) scale(0.97, 1.04); animation-timing-function: ease-in; }
  56% { transform: scale(1.16, 0.82); animation-timing-function: ease-out; }
  68% { transform: translateY(-3px) scale(0.95, 1.06); animation-timing-function: ease-in-out; }
  82% { transform: scale(1.03, 0.97); animation-timing-function: ease-in-out; }
  100% { transform: none; }
`;

const feet = keyframes`
  0%, 100% { transform: none; }
  17% { transform: translateY(1px); animation-timing-function: ease-in; }
  28% { transform: translateY(-2px); animation-timing-function: ease-out; }
  44% { transform: translateY(-6px); animation-timing-function: ease-in; }
  56% { transform: translateY(1px); animation-timing-function: ease-out; }
  68% { transform: none; }
`;

const breathe = keyframes`
  from { transform: none; }
  to { transform: scale(1.015, 1.035); }
`;

const scrabble = keyframes`
  0%, 100% { transform: none; }
  20% { transform: rotate(calc(var(--dir) * 18deg)); }
  45% { transform: rotate(calc(var(--dir) * -10deg)); }
  70% { transform: rotate(calc(var(--dir) * 14deg)); }
`;

const thunk = keyframes`
  0%, 100% { transform: none; }
  35% { transform: scale(1.12, 0.8); }
`;

const drum = keyframes`
  0%, 9%, 100% { transform: none; }
  3.5% { transform: rotate(calc(var(--dir) * 16deg)); }
`;

const Layer = styled('svg')`
  position: absolute;
  top: -148px;
  left: 8px;
  width: 140px;
  height: 180px;
  overflow: hidden;
  pointer-events: none;
  visibility: hidden;
  clip-path: inset(0 0 32px 0);
  transition: visibility 0s 0.24s;

  &.back {
    z-index: -1;
  }
  /* Sits above the button label (z-index 1) and clips 4px higher since the hovered face lifts 3px. */
  &.front {
    z-index: 2;
    clip-path: inset(0 0 36px 0);
  }

  .rise1 {
    transform: translateY(50px);
  }
  .rise2 {
    transform: translateY(40px);
  }
  .rise3 {
    transform: translateY(26px);
  }
  .reach {
    transform: translateY(76px);
  }
  .slam {
    transform: translate(calc(var(--dir) * -20px), -16px)
      rotate(calc(var(--dir) * 110deg));
  }
  .rise1,
  .rise2,
  .rise3,
  .reach,
  .slam {
    transition: transform 0.2s cubic-bezier(0.55, 0, 0.9, 0.45);
  }

  .squash {
    transform-origin: 70px 108px;
  }
  .ant-l {
    transform-origin: 62px 50px;
  }
  .ant-r {
    transform-origin: 80px 48px;
  }
  .eye-l {
    transform-origin: 57px 70px;
  }
  .eye-r {
    transform-origin: 89px 58px;
  }
  .leg-l {
    --dir: 1;
    transform-origin: 46px 88px;
  }
  .leg-r {
    --dir: -1;
    transform-origin: 98px 88px;
  }
  .claws-l {
    --dir: 1;
  }
  .claws-r {
    --dir: -1;
  }
  .claws-l .slam {
    transform-origin: 56px 104px;
  }
  .claws-r .slam {
    transform-origin: 88px 104px;
  }
  .tap-0 {
    --i: 0;
    transform-origin: 50px 104px;
  }
  .tap-1 {
    --i: 1;
    transform-origin: 64px 105px;
  }
  .tap-2 {
    --i: 2;
    transform-origin: 80px 105px;
  }
  .tap-3 {
    --i: 3;
    transform-origin: 94px 104px;
  }
`;

const Hideout = styled(Stack)`
  isolation: isolate;

  &:hover:has(> [aria-disabled='false']) {
    .layer {
      visibility: visible;
      transition: visibility 0s ${at(0)};

      /* Outranks the global reduced-motion reset, which zeroes every transition delay. */
      @media (prefers-reduced-motion: reduce) {
        transition-delay: ${at(0)} !important;
      }
    }
    .layer.front {
      clip-path: inset(0);
      transition:
        visibility 0s ${at(0)},
        clip-path 0s ${at(2.82)};
    }

    .rise1 {
      transform: none;
      transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) ${at(0)};
    }
    .rise2 {
      transform: none;
      transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${at(0.9)};
    }
    .rise3 {
      transform: none;
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) ${at(3.2)};
    }
    .reach,
    .slam {
      transform: none;
    }
    .claws-l .reach {
      transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1) ${at(2.6)};
    }
    .claws-r .reach {
      transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1) ${at(2.55)};
    }
    .claws-l .slam {
      transition: transform 0.15s cubic-bezier(0.5, 0, 0.9, 0.5) ${at(2.82)};
    }
    .claws-r .slam {
      transition: transform 0.15s cubic-bezier(0.5, 0, 0.9, 0.5) ${at(2.9)};
    }

    .claws-l,
    .claws-r {
      animation: ${feet} 0.9s ${at(3.05)};
    }
    .claws-l .tap {
      animation:
        ${thunk} 0.22s ease-out ${at(2.97)},
        ${drum} 3.2s ease-in-out calc(${at(4.6)} + var(--i) * 0.11s) infinite;
    }
    .claws-r .tap {
      animation:
        ${thunk} 0.22s ease-out ${at(3.05)},
        ${drum} 3.2s ease-in-out calc(${at(4.6)} + var(--i) * 0.11s) infinite;
    }
    .squash {
      animation:
        ${hop} 0.9s ${at(3.05)},
        ${breathe} 1.6s ease-in-out ${at(4.4)} infinite alternate;
    }
    .ant-l {
      animation:
        ${sniff} 0.6s ease-in-out ${at(0.35)},
        ${boing} 0.85s ease-out ${at(3.55)},
        ${sway} 2.4s ease-in-out ${at(4.4)} infinite alternate;
    }
    .ant-r {
      animation:
        ${sniff} 0.6s ease-in-out ${at(0.42)},
        ${boing} 0.85s ease-out ${at(3.6)},
        ${sway} 2.4s ease-in-out ${at(5.6)} infinite alternate-reverse;
    }
    .pupil {
      animation:
        ${look} 0.8s ease-in-out ${at(1.6)},
        ${glance} 7s ease-in-out ${at(5)} infinite;
    }
    .eye-l,
    .eye-r {
      animation:
        ${blinkTwice} 0.45s ease-in-out ${at(2.35)},
        ${blink} 4.6s ease-in-out ${at(5.2)} infinite;
    }
    .leg-l {
      animation: ${scrabble} 0.35s linear ${at(3.15)};
    }
    .leg-r {
      animation: ${scrabble} 0.35s linear ${at(3.18)};
    }
  }
`;
