import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Count from 'sentry/components/count';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import useOrganization from 'sentry/utils/useOrganization';
import {getReleaseNewIssuesUrl} from 'sentry/views/releases/utils';

export type SessionHealthItem = {
  crash_free_sessions: number;
  date: string;
  error_count: number;
  project_id: number;
  release: string;
  sessions: number;
  stage: string;
};

interface Props {
  data: SessionHealthItem[];
  isError: boolean;
  isLoading: boolean;
  location: Location<any>;
  meta: EventsMetaType;
}

const BASE_COLUMNS: Array<GridColumnOrder<string>> = [
  {key: 'release', name: 'version'},
  {key: 'date', name: 'date created'},
  {key: 'stage', name: 'stage'},
  {key: 'crash_free_sessions', name: 'crash free rate'},
  {key: 'sessions', name: 'total sessions'},
  {key: 'error_count', name: 'new issues'},
];

export default function ReleaseTable({data, isError, isLoading, location, meta}: Props) {
  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: 'date', kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS,
    location,
  });

  const organization = useOrganization();

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

  const renderBodyCell = useCallback(
    (column: any, dataRow: any) => {
      const value = dataRow[column.key];

      if (column.key === 'crash_free_sessions') {
        return `${value.toFixed(2)}%`;
      }

      if (column.key === 'error_count') {
        return (
          <Tooltip title={t('Open in Issues')} position="auto-start">
            <GlobalSelectionLink
              to={getReleaseNewIssuesUrl(
                organization.slug,
                dataRow.project_id,
                dataRow.release
              )}
            >
              <Count value={value} />
            </GlobalSelectionLink>
          </Tooltip>
        );
      }
      if (!meta?.fields) {
        return value;
      }

      const renderer = getFieldRenderer(column.key, meta.fields, false);

      return (
        <CellWrapper>
          {renderer(dataRow, {
            location,
            organization,
            unit: meta.units?.[column.key],
          })}
        </CellWrapper>
      );
    },
    [organization, location, meta]
  );

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
        renderBodyCell: (column, row) => renderBodyCell(column, row),
      }}
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

const CellWrapper = styled('div')`
  & div {
    text-align: left;
  }
`;
