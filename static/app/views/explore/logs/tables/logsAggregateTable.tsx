import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Pagination from 'sentry/components/pagination';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {IconStack} from 'sentry/icons/iconStack';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  LOGS_AGGREGATE_CURSOR_KEY,
  useLogsFields,
  useLogsSearch,
  useLogsSortBys,
  useSetLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_AGGREGATE_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {LogFieldRenderer} from 'sentry/views/explore/logs/fieldRenderers';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {useLogsAggregatesQuery} from 'sentry/views/explore/logs/useLogsQuery';
import {SeverityLevel, viewLogsSamplesTarget} from 'sentry/views/explore/logs/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';

export function LogsAggregateTable() {
  const {data, pageLinks, isLoading, error} = useLogsAggregatesQuery({
    limit: 50,
  });

  const setLogsPageParams = useSetLogsPageParams();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const search = useLogsSearch();
  const fields = useLogsFields();
  const sorts = useLogsSortBys();
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
    <TableContainer>
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

            return (
              <SortLink
                key={i}
                align={func ? 'right' : 'left'}
                canSort
                direction={
                  aggregateSortBys?.[0]?.field === column.key
                    ? aggregateSortBys?.[0]?.kind
                    : undefined
                }
                generateSortLink={() => ({
                  ...location,
                  query: {
                    ...location.query,
                    [LOGS_AGGREGATE_SORT_BYS_KEY]:
                      aggregateSortBys?.[0]?.field === column.key
                        ? aggregateSortBys?.[0]?.kind === 'asc'
                          ? `-${column.key}`
                          : column.key
                        : `-${column.key}`,
                    [LOGS_AGGREGATE_CURSOR_KEY]: undefined,
                  },
                })}
                title={title}
              />
            );
          },
          renderBodyCell: (column, row) => {
            const value =
              typeof row[column.key] === 'undefined'
                ? null
                : (row[column.key] as string | number);
            const extra: RendererExtra = {
              attributes: row,
              attributeTypes: data?.meta?.fields ?? {},
              highlightTerms: [],
              logColors: getLogColors(SeverityLevel.DEFAULT, theme),
              location,
              organization,
              theme,
              unit: data?.meta?.units?.[column.key],
            };
            return (
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
              fields,
              groupBys,
              visualizes,
              sorts,
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
      <Pagination
        pageLinks={pageLinks}
        onCursor={cursor => setLogsPageParams({aggregateCursor: cursor})}
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
