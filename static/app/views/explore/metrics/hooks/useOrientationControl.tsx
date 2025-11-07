import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';

export type TableOrientation = 'right' | 'bottom';

export function useTableOrientationControl(): {
  canChangeOrientation: boolean;
  orientation: TableOrientation;
  visible: boolean;
} {
  const breakpoints = useBreakpoints();
  const visualize = useMetricVisualize();

  // Derive the actual orientation based on screen size
  const effectiveOrientation = breakpoints.md
    ? visualize.tableConfig?.orientation
    : 'bottom';
  const canChangeOrientation = breakpoints.md;

  return {
    orientation: effectiveOrientation ?? 'right',
    canChangeOrientation,
    visible: visualize.tableConfig?.visible ?? true,
  };
}
