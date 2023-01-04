import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';

type Props = {
  handleSort: ReturnType<typeof useSortNetwork>['handleSort'];
  index: number;
  sortConfig: ReturnType<typeof useSortNetwork>['sortConfig'];
};

export const HEADER_HEIGHT = 25;

const COLUMNS = [
  {
    key: 'status',
    label: t('Status'),
    field: 'status',
    sortFn: row => row.data.statusCode,
  },
  {key: 'path', label: t('Path'), field: 'description'},
  {key: 'type', label: t('Type'), field: 'op'},
  {key: 'size', label: t('Size'), field: 'size', sortFn: row => row.data.size},
  {
    key: 'duration',
    label: t('Duration'),
    field: 'duration',
    sortFn: row => row.endTimestamp - row.startTimestamp,
  },
  {key: 'timestamp', label: t('Timestamp'), field: 'startTimestamp'},
];

export const COLUMN_COUNT = COLUMNS.length;

function NetworkHeaderCell({handleSort, index, sortConfig}: Props) {
  const {field, label, sortFn} = COLUMNS[index];
  return (
    <HeaderButton onClick={() => handleSort(field, sortFn)}>
      {label}
      <IconArrow
        color="gray300"
        size="xs"
        direction={sortConfig.by === field && !sortConfig.asc ? 'down' : 'up'}
        style={{visibility: sortConfig.by === field ? 'visible' : 'hidden'}}
      />
    </HeaderButton>
  );
}

const HeaderButton = styled('button')`
  border: 0;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  line-height: 16px;
  text-align: unset;
  text-transform: uppercase;

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(0.5)} ${space(1)} ${space(0.5)} ${space(1.5)};

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default NetworkHeaderCell;
