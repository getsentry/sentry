import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

const drawP3 = keyframes`
  0%, 3% { stroke-dashoffset: 522; }
  43% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -522; }
`;

const drawP2 = keyframes`
  0%, 5% { stroke-dashoffset: 522; }
  42% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -522; }
`;

const drawP1 = keyframes`
  0%, 7% { stroke-dashoffset: 522; }
  43% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -522; }
`;

const PRIDE_LOOP = '2350ms';

/**
 * The animated rainbow Sentry logo shown on the app boot splash during Pride
 * month. Ported from the `#loader-pride` markup in `static/index.ejs` so it can
 * be reused outside of the initial HTML shell (e.g. in a modal).
 */
const PrideSplash = styled('svg')`
  #pride-mask g[data-index] path {
    stroke-dasharray: 522;
    stroke-dashoffset: 522;
    animation-duration: ${PRIDE_LOOP};
    animation-iteration-count: infinite;
    animation-fill-mode: both;
    animation-timing-function: cubic-bezier(0.455, 0.03, 0.515, 0.955);
  }

  #pride-mask path:nth-of-type(3) {
    animation-name: ${drawP3};
  }
  #pride-mask path:nth-of-type(2) {
    animation-name: ${drawP2};
  }
  #pride-mask path:nth-of-type(1) {
    animation-name: ${drawP1};
  }

  @supports (color: color(display-p3 0 0 0)) {
    .pride-red {
      fill: color(display-p3 1 0 0.1686);
    }
    .pride-orange {
      fill: color(display-p3 1 0.5961 0.2196);
    }
    .pride-yellow {
      fill: color(display-p3 1 0.8078 0);
    }
    .pride-green {
      fill: color(display-p3 0 0.62 0.0827);
    }
    .pride-blue {
      fill: color(display-p3 0.16 0.342 1);
    }
    .pride-purple {
      fill: color(display-p3 0.4863 0.1333 0.5098);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #pride-mask g[data-index] path {
      animation: none;
      stroke-dashoffset: 0;
    }
  }
`;

interface PrideSentryLogoProps {
  className?: string;
  size?: number;
}

export function PrideSentryLogo({size = 256, className}: PrideSentryLogoProps) {
  return (
    <PrideSplash
      className={className}
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="pride-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -5"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>

        <mask
          id="pride-mask"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="128"
          height="128"
          style={{maskType: 'alpha'}}
        >
          <g
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke="white"
            fill="none"
            data-index="0"
            filter="url(#pride-goo)"
          >
            <path d="M11 108.76 20.35 92.64M11 108.76H47.49A37.4 37.4 0 0029.69 76.53L38.5 61.33A55 55 0 0165.07 108.75H81.18A71 71 0 0046.48 47.55L64 17.33 117 108.76H99.1" />
            <path d="M13.96 87.73 4.1 104.75a8 8 0 0 0 6.92 12h36.33c1.59-9.77-2.3-19.24-7.9-27.72-4.33-6.58-11.74-10.48-19.15-12.96l10.34-15.38c9.62 3.9 16.91 10.65 22.7 19.43a51.7 51.7 0 0 1 7.89 36.64H86.7a77 77 0 0 0-12.27-50.8C68.6 58 54.06 41.29 42.66 38.23l14.44-24.9a8 8 0 0 1 13.84 0l53 91.43a8 8 0 0 1-6.91 12H98.49" />
            <path d="M18.82 87.29 8.4 105.25a5 5 0 0 0 4.33 7.5h28.96a31.8 31.8 0 0 0-18.42-33.14L34.3 56.24c8.8 4.5 18.43 12 23.96 20.38 7.08 10.72 9.33 23.45 8.37 36.14h17.96a74.6 74.6 0 0 0-12.2-45.46c-6.99-10.6-19.67-18.25-30.7-24.06L59.55 16.1a5 5 0 0 1 8.5.25l51.55 88.9a5 5 0 0 1-4.33 7.5H98.95" />
          </g>
        </mask>
      </defs>

      <g id="base" fill="#F0F0F2">
        <path d="m5.45 101.3 7.68-13.2c2.95 1 5.7 2.57 8.07 4.58l-7.71 13.29a1.32 1.32 0 0 0 1.15 1.99h25.91a36.2 36.2 0 0 0-17.9-27.16c-2.1-1.2-3.04-3.88-1.82-5.98l2.4-4.11 8.18-14.1a3.8 3.8 0 0 1 5.15-1.5q2.45 1.36 4.76 2.92c14.8 10 27.42 31.88 28.53 49.93h10.64c-1.25-23.34-14-46.36-33.82-59.13a100 100 0 0 0-4.29-2.65 4.17 4.17 0 0 1-1.62-5.68l14.06-24.21c4.02-6.9 14.34-6.9 18.36 0l49.37 85.01a10.62 10.62 0 0 1-9.19 15.96h-13q.26-4.64.06-9.29h12.94a1.33 1.33 0 0 0 1.15-2L65.15 20.95c-.5-.86-1.8-.86-2.3 0L51.34 40.78c23.42 15.28 37.05 38.74 38.45 66.99.1 2.01.1 4.06.07 5.74a3.85 3.85 0 0 1-3.9 3.75H64.83a4.25 4.25 0 0 1-4.16-4.39q.05-2.45-.13-4.91v.01a56.2 56.2 0 0 0-23.9-41.87v-.01L31.3 75.3c11 7.94 17.38 19.16 18.58 32.61q.26 2.9.14 5.81a3.76 3.76 0 0 1-3.83 3.54H14.64c-1.91.01-3.8-.5-5.44-1.47a10.77 10.77 0 0 1-3.75-14.49" />
      </g>

      <g mask="url(#pride-mask)">
        <path
          className="pride-red"
          fill="#FF002B"
          d="M44.37 117.26q.69-4.66.18-9.3H14.64a1.3 1.3 0 0 1-1.15-.66 1.3 1.3 0 0 1 0-1.33l7.71-13.29a25 25 0 0 0-8.07-4.58l-7.68 13.2c-2 3.46-1.81 7.35-.14 10.42a10.5 10.5 0 0 0 9.33 5.54z"
        />
        <path
          className="pride-orange"
          fill="#FF9838"
          d="M46.2 117.26a3.76 3.76 0 0 0 3.82-3.54 45 45 0 0 0-6.01-24.34H44A45 45 0 0 0 31.3 75.3c-5.19-3.74-.01.01-.01.01-3.96-3.07-7.71-4.47-8.06-4.62l-2.4 4.13c-1.22 2.1-.29 4.78 1.82 5.98q2.05 1.16 3.94 2.59l.01.01a36 36 0 0 1 9.37 10.62 36 36 0 0 1 4.58 13.94c.55 4.91 0 9.3 0 9.3z"
        />
        <path
          className="pride-purple"
          fill="#7C2282"
          d="M113.36 117.26c8.2 0 13.3-8.87 9.19-15.96L94.44 52.89l-8.04 4.66 28.11 48.42c.52.89-.12 2-1.15 2h-12.94q.2 4.65-.06 9.29z"
        />
        <path
          className="pride-blue"
          fill="#2957FF"
          d="M73.18 16.29a10.62 10.62 0 0 0-18.36 0L43.29 36.14a85 85 0 0 1 8.05 4.64l11.51-19.83a1.33 1.33 0 0 1 2.3 0l22.35 38.5a4.65 4.65 0 1 0 8.03-4.67z"
        />
        <path
          className="pride-green"
          fill="#009E15"
          d="M85.96 117.26a3.85 3.85 0 0 0 3.9-3.76A85 85 0 0 0 78.5 69.47v-.01a85 85 0 0 0-35.21-33.32l-2.53 4.36a4.17 4.17 0 0 0 1.62 5.68 96 96 0 0 1 4.29 2.65c6.24 4.02 17.92 15.13 23.79 25.28a76 76 0 0 1 10.03 33.85H69.85l-.1 9.3z"
        />
        <path
          className="pride-yellow"
          fill="#FFCE00"
          d="M41.32 58.03a65 65 0 0 0-4.76-2.92 3.8 3.8 0 0 0-5.15 1.5l-2.82 4.85-5.36 9.25a45 45 0 0 1 8.06 4.62l5.35-9.24v.01a56 56 0 0 1 16.57 17.97 56 56 0 0 1 7.33 23.9v-.01q.18 2.45.13 4.91a4.25 4.25 0 0 0 4.16 4.39h4.93q.37-4.65.1-9.3h-.01a65 65 0 0 0-8.6-28.54h.01a65 65 0 0 0-19.94-21.39"
        />
      </g>
    </PrideSplash>
  );
}
