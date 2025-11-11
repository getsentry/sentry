import {useMemo} from 'react';

import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useTableConfig} from 'sentry/views/explore/metrics/metricsQueryParams';

export type TableOrientation = 'right' | 'bottom';

export function useTableOrientationControl(): {
  canChangeOrientation: boolean;
  orientation: TableOrientation;
  visible: boolean;
} {
  const breakpoints = useBreakpoints();
  const tableConfig = useTableConfig();

  // Derive the actual orientation based on screen size
  const effectiveOrientation = breakpoints.md ? tableConfig?.orientation : 'bottom';
  const canChangeOrientation = breakpoints.md;

  return useMemo(
    () => ({
      orientation: effectiveOrientation ?? 'right',
      canChangeOrientation,
      visible: tableConfig?.visible ?? true,
    }),
    [effectiveOrientation, canChangeOrientation, tableConfig?.visible]
  );
}
