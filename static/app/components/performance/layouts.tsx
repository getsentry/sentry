import {Grid, type GridProps} from '@sentry/scraps/layout';

/**
 * Common performance layouts
 */

type PerformanceLayoutBodyRowProps = Omit<GridProps, 'columns'> & {
  minSize: number;
};

export function PerformanceLayoutBodyRow({
  minSize,
  ...props
}: PerformanceLayoutBodyRowProps) {
  const largeColumns = `repeat(auto-fit, minmax(${minSize}px, 1fr))`;

  return (
    <Grid
      {...props}
      gap="xl"
      columns={{zero: '1fr', xl: 'repeat(2, 1fr)', '3xl': largeColumns}}
    />
  );
}
