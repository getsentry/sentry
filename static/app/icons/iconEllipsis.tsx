import {forwardRef, Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface IconEllipsisProps extends SVGIconProps {
  compact?: boolean;
}

const IconEllipsis = forwardRef<SVGSVGElement, IconEllipsisProps>(
  ({compact = false, ...props}: IconEllipsisProps, ref) => {
    const theme = useTheme();
    const circleRadius = compact ? 1.11 : 1.31;
    const circleSpacing = compact ? 5.5 : 6.69;
    return (
      <SvgIcon {...props} ref={ref}>
        {theme.isChonk ? (
          <Fragment>
            <circle cx="3.25" cy="8" r=".5" />
            <circle cx="8" cy="8" r=".5" />
            <circle cx="12.75" cy="8" r=".5" />
          </Fragment>
        ) : (
          <Fragment>
            <circle cx="8" cy="8" r={circleRadius} />
            <circle cx={8 - circleSpacing} cy="8" r={circleRadius} />
            <circle cx={8 + circleSpacing} cy="8" r={circleRadius} />
          </Fragment>
        )}
      </SvgIcon>
    );
  }
);

IconEllipsis.displayName = 'IconEllipsis';

export {IconEllipsis};
