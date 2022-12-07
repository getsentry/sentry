import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';
import space from 'sentry/styles/space';
import {
  COLUMNS,
  ISortConfig,
  ROW_HEIGHT,
} from 'sentry/views/replays/detail/network/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  handleSort: (
    fieldName: string | keyof NetworkSpan,
    getValue?: (row: NetworkSpan) => any
  ) => void;
  index: number;
  sortConfig: ISortConfig;
  style?: CSSProperties;
};

function NetworkHeaderCell({handleSort, index, sortConfig, style}: Props) {
  const {field, label, sortFn} = COLUMNS[index];
  return (
    <SortItem style={style}>
      <UnstyledHeaderButton onClick={() => handleSort(field, sortFn)}>
        {label}
        {sortConfig.by === field ? (
          <IconArrow
            color="gray300"
            size="xs"
            direction={sortConfig.by === field && !sortConfig.asc ? 'down' : 'up'}
          />
        ) : null}
      </UnstyledHeaderButton>
    </SortItem>
  );
}

const UnstyledButton = styled('button')`
  border: 0;
  background: none;
  padding: 0;
  text-transform: inherit;
  width: 100%;
  text-align: unset;
`;

const UnstyledHeaderButton = styled(UnstyledButton)`
  padding: ${space(0.5)} ${space(1)} ${space(0.5)} ${space(1.5)};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SortItem = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  background: ${p => p.theme.backgroundSecondary};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;

  max-height: ${ROW_HEIGHT.header}px;
  line-height: 16px;
  text-transform: uppercase;

  border-bottom: 1px solid ${p => p.theme.innerBorder};

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default NetworkHeaderCell;
