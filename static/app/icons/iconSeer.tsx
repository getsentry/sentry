import {Fragment} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconSeer(props: SVGIconProps) {
  return (
    <SvgIcon {...props} kind="path" width={24} height={24}>
      <Fragment>
        <path
          d="M7.31261 0.970002L1.12261 9.18C0.942609 9.41 0.982609 9.75 1.21261 9.93L7.41261 15.06C7.61261 15.23 7.91261 15.23 8.11261 15.06L14.3026 9.93C14.5326 9.74 14.5726 9.41 14.3926 9.18L8.19261 0.970002C7.97261 0.680002 7.53261 0.680002 7.31261 0.970002Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M7.37257 6.39L4.35257 8.79C4.15257 8.95 4.16257 9.19 4.38257 9.34C4.38257 9.34 7.21257 11.29 7.40257 11.43C7.60257 11.57 7.90257 11.57 8.10257 11.43L11.1426 9.34C11.3526 9.19 11.3626 8.95 11.1726 8.79L8.13257 6.39C7.93257 6.23 7.58257 6.23 7.38257 6.39H7.37257Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M7.73267 8.53V9.28"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Fragment>
    </SvgIcon>
  );
}

IconSeer.displayName = 'IconSeer';

export {IconSeer};
