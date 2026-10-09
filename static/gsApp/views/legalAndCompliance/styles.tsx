import {Grid} from '@sentry/scraps/layout';

import {PanelItem} from 'sentry/components/panels/panelItem';

export function PanelItemPolicy({children}: {children: React.ReactNode}) {
  return (
    <PanelItem>
      <Grid width="100%" columns={{zero: '1fr auto', xl: '1fr 1fr'}} align="center">
        {children}
      </Grid>
    </PanelItem>
  );
}
