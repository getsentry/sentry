import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {IconStack} from 'sentry/icons/iconStack';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import CellAction, {updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {ALLOWED_CELL_ACTIONS} from 'sentry/views/explore/components/table';
import {useTraceMetricsAggregatesQuery} from 'sentry/views/explore/metrics/useTraceMetricsQuery';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';

export function MetricsAggregateTable() {
  const {data, isLoading, error, eventView} = useTraceMetricsAggregatesQuery({
    referrer: 'api.explore.metrics.aggregate-table',
  });

  const columns = useMemo(() => {
    return eventView?.getColumns()?.reduce(
      (acc, col) => {
        acc[col.key] = col;
        return acc;
      },
      {} as Record<string, TableColumn<string>>
    );
  }, [eventView]);

  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const search = useQueryParamsSearch();
  const setSearch = useSetQueryParamsSearch();
  const location = useLocation();
  const theme = useTheme();

  const allFields: string[] = [];
  allFields.push(...groupBys.filter(Boolean));
  allFields.push(...visualizes.map(visualize => visualize.yAxis));

  const numberOfRowsNeedingColor = Math.min(data?.data?.length ?? 0, topEventsLimit ?? 0);
  const palette = theme.chart.getColorPalette(numberOfRowsNeedingColor - 1);

  return (
    <TableContainer>
      <GridEditable
        aria-label={t('Metrics Aggregates')}
        isLoading={isLoading}
        error={error}
        data={data?.data ?? []}
        columnOrder={allFields.map(field => ({
          key: field,
          name: field,
          width: COL_WIDTH_UNDEFINED,
        }))}
        columnSortBy={[
          {
            key: allFields[0]!,
            order: 'desc',
          },
        ]}
        grid={{
          renderHeadCell: (column, i) => {
            const field = column.name;
            let title: string;
            const func = parseFunction(field);
            if (func) {
              title = prettifyParsedFunction(func);
            } else {
              title = prettifyTagKey(field);
            }

            const direction: 'asc' | 'desc' | undefined =
              aggregateSortBys?.[0]?.field === column.key
                ? aggregateSortBys?.[0]?.kind
                : undefined;

            return (
              <SortLink
                key={i}
                align={func ? 'right' : 'left'}
                canSort
                direction={direction}
                generateSortLink={() => {
                  // TODO: Implement proper sort link generation for metrics
                  return location;
                }}
                title={title}
              />
            );
          },
          renderBodyCell: (column, row) => {
            const value =
              typeof row[column.key] === 'undefined'
                ? null
                : (row[column.key] as string | number);

            let rendered = (
              <span>
                {value === null || value === undefined ? (
                  <EmptyValue>{t('(none)')}</EmptyValue>
                ) : (
                  value
                )}
              </span>
            );

            const cellActionColumn = columns?.[column.key];
            if (cellActionColumn) {
              rendered = (
                <CellAction
                  column={cellActionColumn}
                  dataRow={row as TableDataRow}
                  handleCellAction={(actions, newValue) => {
                    const newSearch = search.copy();
                    updateQuery(newSearch, actions, cellActionColumn, newValue);
                    setSearch(newSearch);
                  }}
                  allowActions={ALLOWED_CELL_ACTIONS}
                >
                  {rendered}
                </CellAction>
              );
            }

            return rendered;
          },
          prependColumnWidths: ['40px'],
          renderPrependColumns: (isHeader, _dataRow, rowIndex) => {
            // rowIndex is only defined when `isHeader=false`
            if (isHeader || !defined(rowIndex)) {
              return [<span key="header-icon" />];
            }

            // TODO: Implement proper sample view target for metrics
            const target = location;

            return [
              <Fragment key={`sample-${rowIndex}`}>
                {topEventsLimit && rowIndex < topEventsLimit && (
                  <TopResultsIndicator color={palette[rowIndex]!} />
                )}
                <Tooltip title={t('View Samples')} containerDisplayMode="flex">
                  <StyledLink to={target}>
                    <IconStack />
                  </StyledLink>
                </Tooltip>
              </Fragment>,
            ];
          },
        }}
      />
    </TableContainer>
  );
}

const TableContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const TopResultsIndicator = styled('div')<{color: string}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 16px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => p.color};
`;

const StyledLink = styled(Link)`
  display: flex;
`;

const EmptyValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
