import {useResponsivePropValue} from '@sentry/scraps/layout';

import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';

export type TopBarActionDisplay = 'icon' | 'label';

export function useTopBarActionDisplay(): {
  display: TopBarActionDisplay;
  isSearchInMobileRow: boolean;
} {
  const isSearchInMobileRow = usePrimaryNavigation().layout === 'mobile';
  const responsiveDisplay = useResponsivePropValue<TopBarActionDisplay>({
    zero: 'icon',
    sm: 'label',
  });

  return {
    display: isSearchInMobileRow ? 'icon' : responsiveDisplay,
    isSearchInMobileRow,
  };
}
