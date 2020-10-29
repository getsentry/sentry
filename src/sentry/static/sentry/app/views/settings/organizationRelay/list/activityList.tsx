import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {PanelTable} from 'app/components/panels';
import {RelayActivity} from 'app/types';
import DateTime from 'app/components/dateTime';

type Props = {
  activities: Array<RelayActivity>;
};

const ActivityList = ({activities}: Props) => (
  <StyledPanelTable headers={[t('Version'), t('First Used'), t('Last Used')]}>
    {activities.map(({relayId, version, firstSeen, lastSeen}) => {
      return (
        <React.Fragment key={relayId}>
          <div>{version}</div>
          <DateTime date={firstSeen} seconds={false} />
          <DateTime date={lastSeen} seconds={false} />
        </React.Fragment>
      );
    })}
  </StyledPanelTable>
);

export default ActivityList;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: repeat(3, 2fr);

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: 2fr repeat(2, 1fr);
  }
`;
