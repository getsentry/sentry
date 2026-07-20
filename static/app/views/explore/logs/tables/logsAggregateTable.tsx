import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import {Tooltip} from '@sentry/scraps/tooltip';

import {COL_WIDTH_UNDEFINED, GridEditable} from 'sentry/components/tables/gridEditable';
import {SortLink} from 'sentry/components/tables/gridEditable/sortLink';
import {IconStack} from 'sentry/icons/iconStack';
import {t} from 'sentry/locale';
import {parseCursor} from 'sentry/utils/cursor';
import {defined} from 'sentry/utils/defined';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {FieldValueType, prettifyTagKey} from 'sentry/utils/fields';
import {isRateLimitError} from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {CellAction, updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {ALLOWED_CELL_ACTIONS} from 'sentry/views/explore/components/table';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {LogFieldRenderer} from 'sentry/views/explore/logs/fieldRenderers';
import {getTargetWithReadableQueryParams} from 'sentry/views/explore/logs/logsQueryParams';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {addValidatedFieldTypesToLogsMeta} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {LogsRateLimitError} from 'sentry/views/explore/logs/tables/logsRateLimitError';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {type LogsAggregatesTableResult} from 'sentry/views/explore/logs/useLogsAggregatesTable';
import {
  getLogSeverityLevel,
  viewLogsSamplesTarget,
} from 'sentry/views/explore/logs/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsAggregateCursor,
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
  validatedFieldTypes = {},
}: {
  aggregatesTableResult: LogsAggregatesTableResult;
  validatedFieldTypes?: Partial<Record<string, FieldValueType>>;
}) {
  const {data, pageLinks, isLoading, error, refetch, eventView} = aggregatesTableResult;
  const meta = useMemo(
    () =>
      addValidatedFieldTypesToLogsMeta({
        meta: data?.meta,
        validatedFieldTypes,
      }),
    [data?.meta, validatedFieldTypes]
  );

  const columns = useMemo(() => {
    return eventView
      ?.getColumns(meta)
      ?.reduce<Record<string, TableColumn<string>>>((acc, col) => {
        acc[col.key] = col;
        return acc;
      }, {});
  }, [eventView, meta]);

  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const setAggregateCursor = useSetQueryParamsAggregateCursor();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const aggregateCursor = useQueryParamsAggregateCursor();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const search = useQueryParamsSearch();
  const setSearch = useSetQueryParamsSearch();
  const fields = useQueryParamsFields();
  const sorts = useQueryParamsSortBys();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const organization = useOrganization();
  const {projects} = useProjects();

  if (isRateLimitError(error)) {
    return (
      <Flex justify="center" align="center" padding="3xl" minHeight="200px">
        <LogsRateLimitError onRetry={refetch} />
      </Flex>
    );
  }

  const allFields: string[] = [];
  allFields.push(
    ...groupBys.filter(Boolean),
    ...visualizes.map(visualize => visualize.yAxis)
  );

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

            const direction =
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
                  const nextSort = (() => {
                    switch (direction) {
                      case 'asc':
                        return {
                          field: visualizes[0]?.yAxis ?? allFields[0]!,
                          kind: 'desc' as const,
                        };
                      case 'desc':
                        return {field: column.key, kind: 'asc' as const};
                      default:
                        return {field: column.key, kind: 'desc' as const};
                    }
                  })();
                  return getTargetWithReadableQueryParams(location, {
                    aggregateSortBys: [nextSort],
                  });
                }}
                title={title}
              />
            );
          },
          renderBodyCell: (column, row) => {
            const value = row[column.key] === undefined ? null : row[column.key]!;
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
              attributeTypes: meta.fields,
              caseSensitiveHighlighting: false,
              highlightTerms: [],
              logColors: getLogColors(level, theme),
              location,
              navigate,
              organization,
              theme,
              unit: data?.meta?.units?.[column.key],
            };

            let rendered = (
              <LogFieldRenderer
                key={column.key}
                extra={extra}
                meta={meta}
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
                {topEventsLimit &&
                  rowIndex < topEventsLimit &&
                  !parseCursor(aggregateCursor)?.offset && (
                    <TopResultsIndicator
                      data-test-id="top-results-indicator"
                      color={palette[rowIndex]!}
                    />
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
