import {useHasContainerQuery, useResponsivePropValue} from '@sentry/scraps/layout';

export function useStackedLayout(): boolean {
  const isStackAtBreakpoint = useResponsivePropValue({zero: true, md: false});
  return useHasContainerQuery() && isStackAtBreakpoint;
}
