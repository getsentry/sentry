import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {RelayActivity} from 'sentry/types/relay';

type Props = {
  activities: RelayActivity[];
};

export function ActivityList({activities}: Props) {
  return (
    <StyledSimpleTable
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Version')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('First Used')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Last Used')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {activities.map(({relayId, version, firstSeen, lastSeen}) => {
        return (
          <SimpleTable.Row key={relayId}>
            <SimpleTable.RowCell>
              <Version>{version}</Version>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <DateTime date={firstSeen} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <DateTime date={lastSeen} />
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
    </StyledSimpleTable>
  );
}

const StyledSimpleTable = styled(SimpleTable)`
  grid-template-columns: minmax(max-content, 2fr) repeat(2, minmax(max-content, 1fr));
`;

const Version = styled('div')`
  font-variant-numeric: tabular-nums;
`;
