import {Fragment} from 'react';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

interface IconRepositoryProps extends SVGIconProps {}

// in order for these icons to be chonk compliant for the future, they need to support stroke instead of path
export function IconRepository({...props}: IconRepositoryProps) {
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
          d="M4.19608 1.88235C4.02568 1.88235 3.88235 2.02568 3.88235 2.19608V9.12043C3.98485 9.10567 4.0896 9.09804 4.19608 9.09804H12.6667V1.88235H4.19608ZM4.19608 10.9804C4.02568 10.9804 3.88235 11.1237 3.88235 11.2941V12.2353C3.88235 12.4057 4.02568 12.549 4.19608 12.549C4.71587 12.549 5.13725 12.9704 5.13725 13.4902C5.13725 14.01 4.71587 14.4314 4.19608 14.4314C2.98608 14.4314 2 13.4453 2 12.2353V11.2941V2.19608C2 0.986085 2.98608 0 4.19608 0H13.6078C14.1276 0 14.549 0.421379 14.549 0.941176V10.0392V13.4902C14.549 14.01 14.1276 14.4314 13.6078 14.4314H11.7255C11.2057 14.4314 10.7843 14.01 10.7843 13.4902C10.7843 12.9704 11.2057 12.549 11.7255 12.549H12.6667V10.9804H4.19608ZM6.70588 11.6078C6.18608 11.6078 5.7647 12.0292 5.7647 12.549V15.0588C5.7647 15.4153 5.96612 15.7412 6.28497 15.9006C6.60383 16.0601 6.98539 16.0257 7.27059 15.8118L7.96078 15.2941L8.65098 15.8118C8.93617 16.0257 9.31774 16.0601 9.63659 15.9006C9.95545 15.7412 10.1569 15.4153 10.1569 15.0588V12.549C10.1569 12.0292 9.73548 11.6078 9.21568 11.6078H6.70588Z"
        />
      </Fragment>
    </SvgIcon>
  );
}

IconRepository.displayName = 'IconRepository';
