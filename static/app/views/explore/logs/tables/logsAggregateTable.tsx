import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Pagination from 'sentry/components/pagination';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {IconStack} from 'sentry/icons/iconStack';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import CellAction, {updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {ALLOWED_CELL_ACTIONS} from 'sentry/views/explore/components/table';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {LogFieldRenderer} from 'sentry/views/explore/logs/fieldRenderers';
import {getTargetWithReadableQueryParams} from 'sentry/views/explore/logs/logsQueryParams';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {type useLogsAggregatesTable} from 'sentry/views/explore/logs/useLogsAggregatesTable';
import {
  getLogSeverityLevel,
  viewLogsSamplesTarget,
} from 'sentry/views/explore/logs/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsSortBys,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParamsAggregateCursor,
  useSetQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';

export function LogsAggregateTable({
  aggregatesTableResult,
}: {
  aggregatesTableResult: ReturnType<typeof useLogsAggregatesTable>;
}) {
  const {data, pageLinks, isLoading, error, eventView} = aggregatesTableResult;

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
  const setAggregateCursor = useSetQueryParamsAggregateCursor();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const search = useQueryParamsSearch();
  const setSearch = useSetQueryParamsSearch();
  const fields = useQueryParamsFields();
  const sorts = useQueryParamsSortBys();
  const location = useLocation();
  const theme = useTheme();
  const organization = useOrganization();
  const {projects} = useProjects();

  const allFields: string[] = [];
  allFields.push(...groupBys.filter(Boolean));
  allFields.push(...visualizes.map(visualize => visualize.yAxis));

  const numberOfRowsNeedingColor = Math.min(data?.data?.length ?? 0, topEventsLimit ?? 0);

  const palette = theme.chart.getColorPalette(numberOfRowsNeedingColor - 1);

  return (
    <Stack>
      <GridEditable
        aria-label={t('Aggregates')}
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
                  return getTargetWithReadableQueryParams(location, {
                    aggregateSortBys: [
                      {
                        field: column.key,
                        kind: direction === 'desc' ? 'asc' : 'desc',
                      },
                    ],
                  });
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
            const level = getLogSeverityLevel(
              typeof row?.[OurLogKnownFieldKey.SEVERITY_NUMBER] === 'number'
                ? row?.[OurLogKnownFieldKey.SEVERITY_NUMBER]
                : null,
              typeof row?.[OurLogKnownFieldKey.SEVERITY] === 'string'
                ? row?.[OurLogKnownFieldKey.SEVERITY]
                : null
            );
            const extra: RendererExtra = {
              attributes: row,
              attributeTypes: data?.meta?.fields ?? {},
              highlightTerms: [],
              logColors: getLogColors(level, theme),
              location,
              organization,
              theme,
              unit: data?.meta?.units?.[column.key],
            };

            let rendered = (
              <LogFieldRenderer
                key={column.key}
                extra={extra}
                meta={data?.meta}
                item={{
                  fieldKey: column.key,
                  value,
                }}
              />
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
          renderPrependColumns: (isHeader, dataRow, rowIndex) => {
            // rowIndex is only defined when `isHeader=false`
            if (isHeader || !defined(rowIndex)) {
              return [<span key="header-icon" />];
            }

            const target = viewLogsSamplesTarget({
              location,
              search,
              fields: fields.slice(),
              groupBys,
              visualizes,
              sorts: sorts.slice(),
              row: dataRow || {},
              projects,
            });

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
      <Pagination pageLinks={pageLinks} onCursor={cursor => setAggregateCursor(cursor)} />
    </Stack>
  );
}

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
