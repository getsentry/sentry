import {IconChevron} from '@sentry/icons/chevron';
import {IconSubtract} from '@sentry/icons/subtract';
import type {SVGIconProps} from '@sentry/icons/svgIcon';

import type {ImpactLevel} from 'sentry/types/group';

import {IMPACT_LEVEL_VARIANT} from './utils';

export function ImpactIcon({level, ...rest}: SVGIconProps & {level: ImpactLevel}) {
  const props = {variant: IMPACT_LEVEL_VARIANT[level], ...rest};
  switch (level) {
    case 'super_low':
      return <IconChevron {...props} direction="down" isDouble />;
    case 'low':
      return <IconChevron {...props} direction="down" />;
    case 'moderate':
      return <IconSubtract {...props} />;
    case 'high':
      return <IconChevron {...props} direction="up" />;
    case 'super_high':
      return <IconChevron {...props} direction="up" isDouble />;
  }
}
