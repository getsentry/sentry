import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import type {RelayActivity} from 'sentry/types/relay';

type Props = {
  activities: RelayActivity[];
};

export function ActivityList({activities}: Props) {
  return (
    <StyledPanelTable headers={[t('Version'), t('First Used'), t('Last Used')]}>
      {activities.map(({relayId, version, firstSeen, lastSeen}) => {
        return (
          <Fragment key={relayId}>
            <Version>{version}</Version>
            <DateTime date={firstSeen} seconds={false} />
            <DateTime date={lastSeen} seconds={false} />
          </Fragment>
        );
      })}
    </StyledPanelTable>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(max-content, 2fr) repeat(2, minmax(max-content, 1fr));
`;

const Version = styled('div')`
  font-variant-numeric: tabular-nums;
`;
