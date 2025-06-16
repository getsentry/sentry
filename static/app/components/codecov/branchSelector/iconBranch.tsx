import {Fragment} from 'react';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

interface IconBranchProps extends SVGIconProps {}

// in order for these icons to be chonk compliant for the future, they need to support stroke instead of path
export function IconBranch({...props}: IconBranchProps) {
  return (
    <SvgIcon
      {...props}
      data-test-id="icon-branch"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Fragment>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.33333 0C2.04467 0 1 1.04467 1 2.33333C1 3.26413 1.54502 4.06764 2.33333 4.44212V11.5579C1.54502 11.9324 1 12.7359 1 13.6667C1 14.9553 2.04467 16 3.33333 16C4.622 16 5.66667 14.9553 5.66667 13.6667C5.66667 12.751 5.13918 11.9585 4.37148 11.5764C4.62112 10.188 6.06155 9 7.66667 9C10.1849 9 12.7145 7.08731 12.9775 4.45265C13.7779 4.08285 14.3333 3.27295 14.3333 2.33333C14.3333 1.04467 13.2887 0 12 0C10.7113 0 9.66667 1.04467 9.66667 2.33333C9.66667 3.24904 10.1942 4.04155 10.9619 4.42357C10.7122 5.81201 9.27178 7 7.66667 7C6.4783 7 5.28739 7.42596 4.33333 8.15274V4.44212C5.12165 4.06763 5.66667 3.26413 5.66667 2.33333C5.66667 1.04467 4.622 0 3.33333 0Z"
        />
      </Fragment>
    </SvgIcon>
  );
}

IconBranch.displayName = 'IconBranch';
