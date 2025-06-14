import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconSeer({ref, ...props}: SVGIconProps) {
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
