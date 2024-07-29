import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface IconEllipsisProps extends SVGIconProps {
  compact?: boolean;
}

const IconEllipsis = forwardRef<SVGSVGElement, IconEllipsisProps>(
  ({compact = false, ...props}: IconEllipsisProps, ref) => {
    const circleRadius = compact ? 1.11 : 1.31;
    const circleSpacing = compact ? 5.5 : 6.69;
    return (
      <SvgIcon {...props} ref={ref}>
        <circle cx="8" cy="8" r={circleRadius} />
        <circle cx={8 - circleSpacing} cy="8" r={circleRadius} />
        <circle cx={8 + circleSpacing} cy="8" r={circleRadius} />
      </SvgIcon>
    );
  }
);

IconEllipsis.displayName = 'IconEllipsis';

export {IconEllipsis};
