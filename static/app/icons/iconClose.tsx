import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  ['data-test-id']?: string;
  /**
   * @deprecated circled variant will be removed.
   */
  isCircled?: boolean;
}

export function IconClose({
  ['data-test-id']: dataTestId = 'icon-close',
  isCircled = false,
  ...props
}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} data-test-id={dataTestId}>
      {theme.isChonk ? (
        <path d="M12.7202 2.21957C13.0131 1.92699 13.488 1.92678 13.7808 2.21957C14.0734 2.51238 14.0733 2.98725 13.7808 3.28012L9.06104 7.99985L13.7808 12.7196C14.0734 13.0124 14.0733 13.4873 13.7808 13.7801C13.4879 14.073 13.0131 14.0729 12.7202 13.7801L8.00049 9.06039L3.28076 13.7801C2.98792 14.073 2.51312 14.0729 2.22021 13.7801C1.92733 13.4872 1.92732 13.0125 2.22021 12.7196L6.93994 7.99985L2.22021 3.28012C1.92732 2.98723 1.92732 2.51247 2.22021 2.21957C2.51313 1.927 2.98797 1.92679 3.28076 2.21957L8.00049 6.9393L12.7202 2.21957Z" />
      ) : isCircled ? (
        <Fragment>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <path d="M5.34,11.41a.71.71,0,0,1-.53-.22.74.74,0,0,1,0-1.06l5.32-5.32a.75.75,0,0,1,1.06,1.06L5.87,11.19A.74.74,0,0,1,5.34,11.41Z" />
          <path d="M10.66,11.41a.74.74,0,0,1-.53-.22L4.81,5.87A.75.75,0,0,1,5.87,4.81l5.32,5.32a.74.74,0,0,1,0,1.06A.71.71,0,0,1,10.66,11.41Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M6.94,8,1.47,13.47a.75.75,0,0,0,0,1.06.75.75,0,0,0,1.06,0L8,9.06l5.47,5.47a.75.75,0,0,0,1.06,0,.75.75,0,0,0,0-1.06L9.06,8l5.47-5.47a.75.75,0,0,0-1.06-1.06L8,6.94,2.53,1.47A.75.75,0,0,0,1.47,2.53Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
