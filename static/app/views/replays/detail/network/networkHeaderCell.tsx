import {CSSProperties, forwardRef} from 'react';
import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';

type SortConfig = ReturnType<typeof useSortNetwork>['sortConfig'];
type Props = {
  handleSort: ReturnType<typeof useSortNetwork>['handleSort'];
  index: number;
  sortConfig: SortConfig;
  style: CSSProperties;
};

const COLUMNS: {
  field: SortConfig['by'];
  label: string;
}[] = [
  {field: 'status', label: t('Status')},
  {field: 'description', label: t('Path')},
  {field: 'op', label: t('Type')},
  {field: 'size', label: t('Size')},
  {field: 'duration', label: t('Duration')},
  {field: 'startTimestamp', label: t('Timestamp')},
];

export const COLUMN_COUNT = COLUMNS.length;

const NetworkHeaderCell = forwardRef<HTMLButtonElement, Props>(
  ({handleSort, index, sortConfig, style}: Props, ref) => {
    const {field, label} = COLUMNS[index];
    return (
      <HeaderButton style={style} onClick={() => handleSort(field)} ref={ref}>
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
);

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
