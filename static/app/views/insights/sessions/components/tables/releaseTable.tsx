import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {DateTime} from 'sentry/components/dateTime';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import TextOverflow from 'sentry/components/textOverflow';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export type SessionHealthItem = {
  crash_free_sessions: number;
  date: string;
  sessions: number;
  stage: string;
  version: string;
};

interface Props {
  data: SessionHealthItem[];
  isError: boolean;
  isLoading: boolean;
  location: Location<any>;
  title?: ReactNode;
}

const BASE_COLUMNS: Array<GridColumnOrder<string>> = [
  {key: 'version', name: 'version'},
  {key: 'date', name: 'date created'},
  {key: 'stage', name: 'stage'},
  {key: 'crash_free_sessions', name: 'crash free rate'},
  {key: 'sessions', name: 'total sessions'},
];

export default function ReleaseTable({data, isError, isLoading, location, title}: Props) {
  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: 'date', kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS,
    location,
  });

  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: [],
      }),
    [currentSort, makeSortLinkGenerator]
  );

  const renderBodyCell = useCallback((column: any, dataRow: any) => {
    const value = dataRow[column.key];
    switch (column.key) {
      case 'date':
        return <DateTime date={value} />;
      case 'version':
        return (
          <VersionWrapper>
            <StyledVersion version={value} tooltipRawVersion anchor={false} />
          </VersionWrapper>
        );
      case 'crash_free_sessions':
        return `${value.toFixed(2)}%`;
      case 'stage':
      case 'sessions':
      default:
        return <TextOverflow>{value}</TextOverflow>;
    }
  }, []);

  const tableEmptyMessage = (
    <MessageContainer>
      <Title>{t('No session health data was found')}</Title>
      <Subtitle>
        {t(
          'There was no session health data within this timeframe. Try expanding your timeframe or changing your global filters.'
        )}
      </Subtitle>
    </MessageContainer>
  );

  return (
    <GridEditable
      error={isError}
      isLoading={isLoading}
      data={data ?? []}
      columnOrder={columns}
      emptyMessage={tableEmptyMessage}
      columnSortBy={[]}
      stickyHeader
      grid={{
        onResizeColumn: handleResizeColumn,
        renderHeadCell,
        renderBodyCell,
      }}
      title={title}
    />
  );
}

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Title = styled('div')`
  font-size: 24px;
`;

const MessageContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(1)};
  justify-items: center;
  text-align: center;
  padding: ${space(4)};
`;

export const VersionWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledVersion = styled(Version)`
  ${p => p.theme.overflowEllipsis};
`;
