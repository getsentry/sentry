import styled from '@emotion/styled';

import type {TableColumnConfig} from '@sentry/scraps/table';

import {DateTime} from 'sentry/components/dateTime';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {RelayActivity} from 'sentry/types/relay';

type Props = {
  activities: RelayActivity[];
};

export function ActivityList({activities}: Props) {
  return (
    <SimpleTable
      columns={ACTIVITY_COLUMNS}
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
    </SimpleTable>
  );
}

// 2xl rather than the token nearest the old `lg` viewport breakpoint: these
// cards render inside a settings column that never gets wider than ~1025px, so a
// larger token would leave the wide layout unreachable.
const ACTIVITY_COLUMNS: TableColumnConfig[] = [
  {key: 'version', width: '2fr'},
  {key: 'firstSeen', width: {zero: '2fr', '2xl': '1fr'}},
  {key: 'lastSeen', width: {zero: '2fr', '2xl': '1fr'}},
];

const Version = styled('div')`
  font-variant-numeric: tabular-nums;
`;
