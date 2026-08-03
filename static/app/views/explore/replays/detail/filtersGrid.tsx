import {Children} from 'react';

import {Grid, type GridProps} from '@sentry/scraps/layout';

export function FiltersGrid({children, ...props}: GridProps) {
  return (
    <Grid
      {...props}
      columns={`repeat(${Children.toArray(children).length - 1}, max-content) 1fr`}
      gap="md"
      marginBottom="md"
      marginTop={{zero: 'md', xl: '0'}}
    >
      {children}
    </Grid>
  );
}
