import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  fieldAlignment,
  formatParsedFunction,
  getAggregateAlias,
  parseFunction,
} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

import {useAnalytics} from '../hooks/useAnalytics';
import {TOP_EVENTS_LIMIT, useTopEvents} from '../hooks/useTopEvents';

import {FieldRenderer} from './fieldRenderer';

export function formatSort(sort: Sort): string {
  const direction = sort.kind === 'desc' ? '-' : '';
  return `${direction}${getAggregateAlias(sort.field)}`;
}

interface AggregatesTableProps {}

export function AggregatesTable({}: AggregatesTableProps) {
  const {selection} = usePageFilters();
  const topEvents = useTopEvents();
  const organization = useOrganization();
  const [dataset] = useDataset();
  const {groupBys} = useGroupBys();
  const [visualizes] = useVisualizes();
  const fields = useMemo(() => {
    return [...groupBys, ...visualizes.flatMap(visualize => visualize.yAxes)].filter(
      Boolean
    );
  }, [groupBys, visualizes]);
  const [sorts, setSorts] = useSorts({fields});
  const [query] = useUserQuery();

  const eventView = useMemo(() => {
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Aggregates',
      fields,
      orderby: sorts.map(formatSort),
      query: search.formatString(),
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, fields, sorts, query, selection]);

  const columns = useMemo(() => eventView.getColumns(), [eventView]);

  const result = useSpansQuery({
    eventView,
    initialData: [],
    referrer: 'api.explore.spans-aggregates-table',
  });

  useAnalytics({
    result,
    visualizes,
    organization,
    columns: groupBys,
    userQuery: query,
    resultsMode: 'aggregate',
  });

  const {tableStyles} = useTableStyles({
    items: fields.map(field => {
      return {
        label: field,
        value: field,
      };
    }),
  });

  const meta = result.meta ?? {};

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  return (
    <Fragment>
      <Table style={tableStyles}>
        <TableHead>
          <TableRow>
            {fields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              let label = field;

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const tag = stringTags[field] ?? numberTags[field] ?? null;
              if (tag) {
                label = tag.name;
              }

              const func = parseFunction(field);
              if (func) {
                label = formatParsedFunction(func);
              }

              const direction = sorts.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSorts([{field, kind}]);
              }

              return (
                <StyledTableHeadCell
                  align={align}
                  key={i}
                  isFirst={i === 0}
                  onClick={updateSort}
                >
                  <span>{label}</span>
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
                </StyledTableHeadCell>
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
            result.data?.map((row, i) => (
              <TableRow key={i}>
                {fields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      {topEvents && i < topEvents && j === 0 && (
                        <TopResultsIndicator index={i} />
                      )}
                      <FieldRenderer
                        column={columns[j]}
                        data={row}
                        unit={meta?.units?.[field]}
                        meta={meta}
                      />
                    </TableBodyCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableStatus>
              <EmptyStateWarning>
                <p>{t('No spans found')}</p>
              </EmptyStateWarning>
            </TableStatus>
          )}
        </TableBody>
      </Table>
      <Pagination pageLinks={result.pageLinks} />
    </Fragment>
  );
}

const TopResultsIndicator = styled('div')<{index: number}>`
  position: absolute;
  left: -1px;
  margin-top: 4.5px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => {
    return CHART_PALETTE[TOP_EVENTS_LIMIT - 1][p.index];
  }};
`;

const StyledTableHeadCell = styled(TableHeadCell)`
  cursor: pointer;
`;
