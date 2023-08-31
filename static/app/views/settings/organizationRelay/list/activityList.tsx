import {Fragment} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import {RelayActivity} from 'sentry/types';

type Props = {
  activities: Array<RelayActivity>;
};

function ActivityList({activities}: Props) {
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

export default ActivityList;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: repeat(3, 2fr);

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 2fr repeat(2, 1fr);
  }
`;

const Version = styled('div')`
  font-variant-numeric: tabular-nums;
`;
