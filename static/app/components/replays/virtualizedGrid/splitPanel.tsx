import {Grid, type GridProps} from '@sentry/scraps/layout';

export function SplitPanel(props: GridProps) {
  return (
    <Grid width="100%" height="100%" overflow="auto" position="relative" {...props} />
  );
}
