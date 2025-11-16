import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface IconEllipsisProps extends SVGIconProps {
  compact?: boolean;
}

export function IconEllipsis({compact = false, ...props}: IconEllipsisProps) {
  const theme = useTheme();
  const circleRadius = compact ? 1.11 : 1.31;
  const circleSpacing = compact ? 5.5 : 6.69;
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M2.5 6.5C3.32843 6.5 4 7.17157 4 8C4 8.82843 3.32843 9.5 2.5 9.5C1.67157 9.5 1 8.82843 1 8C1 7.17157 1.67157 6.5 2.5 6.5ZM8 6.5C8.82843 6.5 9.5 7.17157 9.5 8C9.5 8.82843 8.82843 9.5 8 9.5C7.17157 9.5 6.5 8.82843 6.5 8C6.5 7.17157 7.17157 6.5 8 6.5ZM13.5 6.5C14.3284 6.5 15 7.17157 15 8C15 8.82843 14.3284 9.5 13.5 9.5C12.6716 9.5 12 8.82843 12 8C12 7.17157 12.6716 6.5 13.5 6.5Z" />
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
