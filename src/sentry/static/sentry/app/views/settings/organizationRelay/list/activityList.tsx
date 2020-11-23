import React from 'react';
import styled from '@emotion/styled';

import DateTime from 'app/components/dateTime';
import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import {RelayActivity} from 'app/types';

type Props = {
  activities: Array<RelayActivity>;
  disabled: boolean;
};

const ActivityList = ({activities, disabled}: Props) => (
  <StyledPanelTable
    headers={[t('Version'), t('First Used'), t('Last Used')]}
    disabled={disabled}
  >
    {activities.map(({relayId, version, firstSeen, lastSeen}) => {
      return (
        <React.Fragment key={relayId}>
          <Version>{version}</Version>
          <DateTime date={firstSeen} seconds={false} />
          <DateTime date={lastSeen} seconds={false} />
        </React.Fragment>
      );
    })}
  </StyledPanelTable>
);

export default ActivityList;

const Version = styled('div')``;

const StyledPanelTable = styled(PanelTable)<{disabled: boolean}>`
  grid-template-columns: repeat(3, 2fr);

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: 2fr repeat(2, 1fr);
  }

  ${p =>
    p.disabled &&
    `
      ${DateTime} {
        color: ${p.theme.disabled};
      }

     ${Version} {
        color: ${p.theme.disabled};
      }
    `}
`;
