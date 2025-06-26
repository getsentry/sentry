import {Fragment, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {GridResizer} from 'sentry/components/gridEditable/styles';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconStack} from 'sentry/icons/iconStack';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableHeadCellContent,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {
  useExploreFields,
  useExploreGroupBys,
  useExploreQuery,
  useExploreSortBys,
  useExploreVisualizes,
  useSetExploreSortBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {usePaginationAnalytics} from 'sentry/views/explore/hooks/usePaginationAnalytics';
import {TOP_EVENTS_LIMIT, useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {prettifyAggregation, viewSamplesTarget} from 'sentry/views/explore/utils';

import {FieldRenderer} from './fieldRenderer';

interface AggregatesTableProps {
  aggregatesTableResult: AggregatesTableResult;
}

export function AggregatesTable({aggregatesTableResult}: AggregatesTableProps) {
  const theme = useTheme();
  const location = useLocation();
  const {projects} = useProjects();

  const {result, eventView, fields: tableFields} = aggregatesTableResult;

  const topEvents = useTopEvents();
  const fields = useExploreFields();
  const groupBys = useExploreGroupBys();
  const visualizes = useExploreVisualizes();
  const sorts = useExploreSortBys();
  const setSorts = useSetExploreSortBys();
  const query = useExploreQuery();

  const columns = useMemo(() => eventView.getColumns(), [eventView]);

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(tableFields, tableRef, {
    minimumColumnWidth: 50,
    prefixColumnWidth: 'min-content',
  });

  const meta = result.meta ?? {};

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const numberOfRowsNeedingColor = Math.min(result.data?.length ?? 0, TOP_EVENTS_LIMIT);

  const palette = theme.chart.getColorPalette(numberOfRowsNeedingColor - 1);

  const paginationAnalyticsEvent = usePaginationAnalytics(
    'aggregates',
    result.data?.length ?? 0
  );

  return (
    <Fragment>
      <Table ref={tableRef} style={initialTableStyles}>
        <TableHead>
          <TableRow>
            <TableHeadCell isFirst={false}>
              <TableHeadCellContent />
            </TableHeadCell>
            {tableFields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const label = prettifyField(field, stringTags, numberTags);

              const direction = sorts.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSorts([{field, kind}]);
              }

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <TableHeadCellContent onClick={updateSort}>
                    <Tooltip showOnlyOnOverflow title={label}>
                      {label}
                    </Tooltip>
                    {defined(direction) && (
                      <IconArrow
                        size="xs"
                        direction={
                          direction === 'desc'
                            ? 'down'
                            : direction === 'asc'
                              ? 'up'
                              : undefined
                        }
                      />
                    )}
                  </TableHeadCellContent>
                  {i !== tableFields.length - 1 && (
                    <GridResizer
                      dataRows={
                        !result.isError && !result.isPending && result.data
                          ? result.data.length
                          : 0
                      }
                      onMouseDown={e => onResizeMouseDown(e, i)}
                    />
                  )}
                </TableHeadCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.isPending ? (
            <TableStatus>
              <LoadingIndicator />
            </TableStatus>
          ) : result.isError ? (
            <TableStatus>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </TableStatus>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => {
              const target = viewSamplesTarget({
                location,
                query,
                fields,
                groupBys,
                visualizes,
                sorts,
                row,
                projects,
              });
              return (
                <TableRow key={i}>
                  <TableBodyCell>
                    {topEvents && i < topEvents && (
                      <TopResultsIndicator color={palette[i]!} />
                    )}
                    <Tooltip title={t('View Samples')} containerDisplayMode="flex">
                      <StyledLink to={target}>
                        <IconStack />
                      </StyledLink>
                    </Tooltip>
                  </TableBodyCell>
                  {tableFields.map((field, j) => {
                    return (
                      <TableBodyCell key={j}>
                        <FieldRenderer
                          column={columns[j]!}
                          data={row}
                          unit={meta?.units?.[field]}
                          meta={meta}
                        />
                      </TableBodyCell>
                    );
                  })}
                </TableRow>
              );
            })
          ) : (
            <TableStatus>
              <EmptyStateWarning>
                <p>{t('No spans found')}</p>
              </EmptyStateWarning>
            </TableStatus>
          )}
        </TableBody>
      </Table>
      <Pagination
        pageLinks={result.pageLinks}
        paginationAnalyticsEvent={paginationAnalyticsEvent}
      />
    </Fragment>
  );
}

function prettifyField(
  field: string,
  stringTags: TagCollection,
  numberTags: TagCollection
): string {
  const tag = stringTags[field] ?? numberTags[field] ?? null;
  if (tag) {
    return tag.name;
  }

  return prettifyAggregation(field) ?? field;
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
