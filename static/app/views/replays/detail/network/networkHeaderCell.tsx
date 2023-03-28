import {CSSProperties, forwardRef, Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconInfo} from 'sentry/icons';
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

// `block` so that it's vertically centered :lolsob:
const SizeInfo = styled(IconInfo)`
  display: block;
`;

const COLUMNS: {
  field: SortConfig['by'];
  label: ReactNode;
}[] = [
  {field: 'status', label: t('Status')},
  {field: 'method', label: t('Method')},
  {field: 'description', label: t('Path')},
  {field: 'op', label: t('Type')},
  {
    field: 'size',
    label: (
      <Fragment>
        {t('Size')}
        <Tooltip
          title={t(
            'The number used for fetch/xhr is the response body size. It is possible the network transfer size is smaller due to compression.'
          )}
        >
          <SizeInfo size="xs" />
        </Tooltip>
      </Fragment>
    ),
  },
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
