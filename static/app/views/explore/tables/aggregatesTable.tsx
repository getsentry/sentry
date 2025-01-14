import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {GridResizer} from 'sentry/components/gridEditable/styles';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  fieldAlignment,
  parseFunction,
  prettifyParsedFunction,
} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
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
  useExploreDataset,
  useExploreGroupBys,
  useExploreQuery,
  useExploreSortBys,
  useExploreTitle,
  useExploreVisualizes,
  useSetExploreSortBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {TOP_EVENTS_LIMIT, useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';

import {FieldRenderer} from './fieldRenderer';

interface AggregatesTableProps {
  aggregatesTableResult: AggregatesTableResult;
  confidences: Confidence[];
}

export function AggregatesTable({
  aggregatesTableResult,
  confidences,
}: AggregatesTableProps) {
  const topEvents = useTopEvents();
  const organization = useOrganization();
  const title = useExploreTitle();
  const dataset = useExploreDataset();
  const groupBys = useExploreGroupBys();
  const visualizes = useExploreVisualizes();

  const {result, eventView, fields} = aggregatesTableResult;

  const sorts = useExploreSortBys();
  const setSorts = useSetExploreSortBys();
  const query = useExploreQuery();

  const columns = useMemo(() => eventView.getColumns(), [eventView]);

  useAnalytics({
    dataset,
    resultLength: result.data?.length,
    resultMode: 'aggregates',
    resultStatus: result.status,
    visualizes,
    organization,
    columns: groupBys,
    userQuery: query,
    confidences,
    title,
  });

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(fields, tableRef);

  const meta = result.meta ?? {};

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  return (
    <Fragment>
      <Table ref={tableRef} styles={initialTableStyles}>
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
                label = prettifyParsedFunction(func);
              }

              const direction = sorts.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSorts([{field, kind}]);
              }

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <TableHeadCellContent onClick={updateSort}>
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
                  </TableHeadCellContent>
                  {i !== fields.length - 1 && (
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
            result.data?.map((row, i) => (
              <TableRow key={i}>
                {fields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      {topEvents && i < topEvents && j === 0 && (
                        <TopResultsIndicator index={i} />
                      )}
                      <FieldRenderer
                        column={columns[j]!}
                        data={row}
                        unit={meta?.units?.[field]}
                        meta={meta}
                        mode={Mode.AGGREGATE}
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
    return CHART_PALETTE[TOP_EVENTS_LIMIT - 1]![p.index];
  }};
`;
