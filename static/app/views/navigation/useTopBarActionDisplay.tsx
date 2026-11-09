import {useResponsivePropValue} from '@sentry/scraps/layout';

import {usePrimaryNavigation} from './primaryNavigationContext';

export type TopBarActionDisplay = 'icon' | 'label';

export function useTopBarActionDisplay(): {
  display: TopBarActionDisplay;
} {
  const isMobile = usePrimaryNavigation().layout === 'mobile';
  const responsiveDisplay = useResponsivePropValue<TopBarActionDisplay>({
    zero: 'icon',
    sm: 'label',
  });

  return {
    display: isMobile ? 'icon' : responsiveDisplay,
  };
}
