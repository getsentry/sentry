import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Pagination from 'sentry/components/pagination';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {t} from 'sentry/locale';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  LOGS_AGGREGATE_CURSOR_KEY,
  useLogsAggregate,
  useLogsAggregateSortBys,
  useLogsGroupBy,
  useSetLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_AGGREGATE_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {LogFieldRenderer} from 'sentry/views/explore/logs/fieldRenderers';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {useLogsAggregatesQuery} from 'sentry/views/explore/logs/useLogsQuery';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';

export function LogsAggregateTable() {
  const {data, pageLinks, isLoading, error} = useLogsAggregatesQuery({
    limit: 50,
  });

  const setLogsPageParams = useSetLogsPageParams();
  const groupBy = useLogsGroupBy();
  const aggregate = useLogsAggregate();
  const aggregateSortBys = useLogsAggregateSortBys();
  const location = useLocation();
  const theme = useTheme();
  const organization = useOrganization();

  const fields: string[] = [];
  if (groupBy) {
    fields.push(groupBy);
  }
  fields.push(aggregate);

  return (
    <TableContainer>
      <GridEditable
        aria-label={t('Aggregates')}
        isLoading={isLoading}
        error={error}
        data={data?.data ?? []}
        columnOrder={fields.map(field => ({
          key: field,
          name: field,
          width: COL_WIDTH_UNDEFINED,
        }))}
        columnSortBy={[
          {
            key: fields[0]!,
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
              highlightTerms: [],
              logColors: getLogColors(SeverityLevel.DEFAULT, theme),
              location,
              organization,
              theme,
            };
            return (
              <LogFieldRenderer
                key={column.key}
                extra={extra}
                item={{
                  fieldKey: column.key,
                  value,
                }}
              />
            );
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
