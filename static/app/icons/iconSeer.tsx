import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconSeer({
  ref,
  variant = 'default',
  ...props
}: SVGIconProps & {variant?: 'default' | 'loading' | 'waiting'}) {
  if (variant === 'loading') {
    return (
      <InteractionWrapper>
        <SvgIcon {...props} ref={ref} viewBox="0 0 16 16" kind="path">
          <g transform="scale(1.18) translate(-1.3, -1.3)">
            <style>{`
        .seer-loading-cls-1 {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1px;
        }
        @keyframes seer-loading-eyeball-animation {
          0%, 20% {
            d: path('M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z');
          }
          21% {
            d: path('M8,9c1.8,0,3.31.22,3.74.52-1.36.08-2.64.11-3.74.11-1.1,0-2.38-.03-3.74-.11.43-.3,1.94-.52,3.74-.52Z');
          }
          22%, 55% {
            d: path('M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z');
          }
          56% {
            d: path('M8,9c1.8,0,3.31.22,3.74.52-1.36.08-2.64.11-3.74.11-1.1,0-2.38-.03-3.74-.11.43-.3,1.94-.52,3.74-.52Z');
          }
          57%, 97% {
            d: path('M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z');
          }
          98% {
            d: path('M8,9c1.8,0,3.31.22,3.74.52-1.36.08-2.64.11-3.74.11-1.1,0-2.38-.03-3.74-.11.43-.3,1.94-.52,3.74-.52Z');
          }
          99%, 100% {
            d: path('M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z');
          }
        }
        @keyframes seer-loading-pupil-animation {
          0%, 2% {
            transform: translate(0, 0);
          }
          4%, 7% {
            transform: translate(-0.2px, -1.4px);
          }
          13%, 17% {
            transform: translate(0.1px, 1.4px);
          }
          19%, 20% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(0, 0);
          }
          21% {
            transform: translate(0, 0.94px);
          }
          22% {
            transform: translate(0, 0);
          }
          23%, 24% {
            transform: translate(0, 0);
          }
          25% { transform: translateX(0.2px); visibility: visible; }
          26% { transform: translateX(-3.6px); visibility: visible; }
          27% { transform: translateX(-3.6px); visibility: hidden; }
          28% { transform: translateX(3.6px); visibility: hidden; }
          29% { transform: translateX(3.6px); visibility: visible; }
          30% { transform: translateX(-3.6px); visibility: visible; }
          31% { transform: translateX(-3.6px); visibility: hidden; }
          32% { transform: translateX(3.6px); visibility: hidden; }
          33% { transform: translateX(3.6px); visibility: visible; }
          34% { transform: translateX(-3.6px); visibility: visible; }
          35% { transform: translateX(-3.6px); visibility: hidden; }
          36% { transform: translateX(3.6px); visibility: hidden; }
          37% { transform: translateX(3.6px); visibility: visible; }
          38% { transform: translateX(-3.6px); visibility: visible; }
          39% { transform: translateX(-3.6px); visibility: hidden; }
          40% { transform: translateX(3.6px); visibility: hidden; }
          41% { transform: translateX(3.6px); visibility: visible; }
          42% { transform: translateX(-3.6px); visibility: visible; }
          43% { transform: translateX(-3.6px); visibility: hidden; }
          44% { transform: translateX(3.6px); visibility: hidden; }
          45% { transform: translateX(3.6px); visibility: visible; }
          46% { transform: translateX(-3.6px); visibility: visible; }
          47% { transform: translateX(-3.6px); visibility: hidden; }
          48% { transform: translateX(3.6px); visibility: hidden; }
          49% { transform: translateX(3.6px); visibility: visible; }
          50% { transform: translateX(-0.2px); visibility: visible; }
          51% { transform: translateX(0); visibility: visible; }
          55% {
            transform: translate(0, 0);
          }
          56% {
            transform: translate(0, 0.94px);
          }
          57%, 60% {
            transform: translate(0, 0);
          }
          66%, 72% {
            transform: translate(-1.2px, 0.7px);
          }
          78%, 82% {
            transform: translate(1.2px, -0.8px);
          }
          88%, 93% {
            transform: translate(1px, 0.7px);
          }
          95%, 96% {
            transform: translate(0, 0);
          }
          97% {
            transform: translate(0, 0);
          }
          98% {
            transform: translate(0, 0.94px);
          }
          99% {
            transform: translate(0, 0);
          }
          95%, 100% {
            transform: translate(0, 0);
          }
        }
        .seer-loading-eyeball {
          animation: seer-loading-eyeball-animation 15s linear infinite;
        }
        .seer-loading-pupil {
          animation: seer-loading-pupil-animation 15s linear infinite;
          transform-origin: 8px 8.3px;
        }
      `}</style>
            <path
              className="seer-loading-cls-1"
              d="M8,3c-1.75,2-4.75,6.25-5.75,9.5,3.77.67,7.77.67,11.5,0-1-3.25-4-7.5-5.75-9.5Z"
            />
            <path
              className="seer-loading-cls-1 seer-loading-eyeball"
              d="M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z"
            />
            <line
              className="seer-loading-cls-1 seer-loading-pupil"
              x1="8"
              y1="8.06"
              x2="8"
              y2="8.56"
            />
          </g>
        </SvgIcon>
      </InteractionWrapper>
    );
  }
  if (variant === 'waiting') {
    return (
      <InteractionWrapper>
        <SvgIcon {...props} ref={ref} viewBox="0 0 16 16" kind="path">
          <g transform="scale(1.18) translate(-1.3, -1.3)">
            <style>{`
        .seer-waiting-cls-1 {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1px;
        }
        @keyframes seer-waiting-eyeball-animation {
          0%, 20% {
            d: path('M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z');
          }
          25% {
            d: path('M8,5.25c1.8,0,3.25,1.75,3.74,4.36-1.36.66-2.64.88-3.74.89-1.1,0-2.38-.23-3.74-.89.49-2.61,1.94-4.36,3.74-4.36Z');
          }
          28% {
            d: path('M8,5.7c1.8,0,3.25,1.75,3.74,3.91-1.36.66-2.64.88-3.74.89-1.1,0-2.38-.23-3.74-.89.49-2.16,1.94-3.91,3.74-3.91Z');
          }
          31% {
            d: path('M8,5.25c1.8,0,3.25,1.75,3.74,4.36-1.36.66-2.64.88-3.74.89-1.1,0-2.38-.23-3.74-.89.49-2.61,1.94-4.36,3.74-4.36Z');
          }
          36%, 89% {
            d: path('M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z');
          }
          92% {
            d: path('M8,9c1.8,0,3.31.22,3.74.52-1.36.08-2.64.11-3.74.11-1.1,0-2.38-.03-3.74-.11.43-.3,1.94-.52,3.74-.52Z');
          }
          95%, 100% {
            d: path('M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z');
          }
        }
        @keyframes seer-waiting-pupil-animation {
          0%, 91%, 93%, 100% {
            transform: translateY(0);
          }
          92% {
            transform: translateY(0.94px);
          }
        }
        .seer-waiting-eyeball {
          animation: seer-waiting-eyeball-animation 5s linear infinite;
        }
        .seer-waiting-pupil {
          animation: seer-waiting-pupil-animation 5s linear infinite;
        }
      `}</style>
            <path
              className="seer-waiting-cls-1"
              d="M8,3c-1.75,2-4.75,6.25-5.75,9.5,3.77.67,7.77.67,11.5,0-1-3.25-4-7.5-5.75-9.5Z"
            />
            <path
              className="seer-waiting-cls-1 seer-waiting-eyeball"
              d="M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z"
            />
            <line
              className="seer-waiting-cls-1 seer-waiting-pupil"
              x1="8"
              y1="8.06"
              x2="8"
              y2="8.56"
            />
          </g>
        </SvgIcon>
      </InteractionWrapper>
    );
  }

  return (
    <SvgIcon {...props} ref={ref} viewBox="0 0 16 16" kind="path">
      <g transform="scale(1.18) translate(-1.3, -1.3)">
        <line
          className="cls-1"
          x1="8"
          y1="8.06"
          x2="8"
          y2="8.56"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          className="cls-1"
          d="M8,6.13c1.8,0,3.31,1.53,3.74,3.59-1.36.58-2.64.77-3.74.78-1.1,0-2.38-.2-3.74-.78.43-2.07,1.94-3.59,3.74-3.59Z"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          className="cls-1"
          d="M8,3c-1.75,2-4.75,6.25-5.75,9.5,3.77.67,7.77.67,11.5,0-1-3.25-4-7.5-5.75-9.5Z"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </SvgIcon>
  );
}

IconSeer.displayName = 'IconSeer';

export {IconSeer};

const rockLeft = keyframes`
  0% {
    transform: rotate(0deg) scaleY(0.8);
  }
  25% {
    transform: rotate(-15deg) scaleY(1);
  }
  50% {
    transform: rotate(0deg) scaleY(0.8);
  }
  75% {
    transform: rotate(15deg) scaleY(1);
  }
  100% {
    transform: rotate(0deg) scaleY(0.8);
  }
`;

const rockRight = keyframes`
  0% {
    transform: rotate(0deg) scaleY(0.8);
  }
  25% {
    transform: rotate(15deg) scaleY(1);
  }
  50% {
    transform: rotate(0deg) scaleY(0.8);
  }
  75% {
    transform: rotate(-15deg) scaleY(1);
  }
  100% {
    transform: rotate(0deg) scaleY(0.8);
  }
`;

const InteractionWrapper = styled('div')`
  display: inline-block;
  transition: transform 1s ease;
  vertical-align: middle;
  line-height: 0;

  &:hover {
    animation: ${rockLeft} 2s ease-in-out infinite;
  }

  &:hover:active {
    animation: ${rockRight} 2s ease-in-out infinite;
  }
`;
