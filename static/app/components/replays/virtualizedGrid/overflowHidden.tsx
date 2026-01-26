import {Grid, type GridProps} from '@sentry/scraps/layout';

export function OverflowHidden(props: GridProps<'div'>) {
  return <Grid height="100%" overflow="hidden" position="relative" {...props} />;
}
