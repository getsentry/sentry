import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import type {Alignments} from 'sentry/components/gridEditable/sortLink';
import {GridBodyCell, GridHeadCell} from 'sentry/components/gridEditable/styles';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconStack} from 'sentry/icons/iconStack';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  fieldAlignment,
  parseFunction,
  prettifyParsedFunction,
  prettifyTagKey,
} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {
  TableBody,
  TableHead,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import {Table} from 'sentry/views/explore/multiQueryMode/components/miniTable';
import {
  useMultiQueryTableAggregateMode,
  useMultiQueryTableSampleMode,
} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTable';
import {
  getSamplesTargetAtIndex,
  type ReadableExploreQueryParts,
  useReadQueriesFromLocation,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {MultiQueryFieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';

interface MultiQueryTableProps {
  confidences: Confidence[];
  index: number;
  mode: Mode;
  query: ReadableExploreQueryParts;
}

export function MultiQueryTable(props: MultiQueryTableProps) {
  const {mode, query: queryParts} = props;
  const {groupBys, query, yAxes, sortBys} = queryParts;

  const aggregatesTableResult = useMultiQueryTableAggregateMode({
    groupBys,
    query,
    yAxes,
    sortBys,
    enabled: mode === Mode.AGGREGATE,
  });

  const spansTableResult = useMultiQueryTableSampleMode({
    groupBys,
    query,
    yAxes,
    sortBys,
    enabled: mode === Mode.SAMPLES,
  });

  return (
    <Fragment>
      {mode === Mode.AGGREGATE && (
        <AggregatesTable aggregatesTableResult={aggregatesTableResult} {...props} />
      )}
      {mode === Mode.SAMPLES && (
        <SpansTable spansTableResult={spansTableResult} {...props} />
      )}
    </Fragment>
  );
}

interface AggregateTableProps extends MultiQueryTableProps {
  aggregatesTableResult: AggregatesTableResult;
}

function AggregatesTable({
  aggregatesTableResult,
  query: queryParts,
  index,
}: AggregateTableProps) {
  const location = useLocation();
  const queries = useReadQueriesFromLocation();

  const topEvents = 5;
  const {result, eventView, fields} = aggregatesTableResult;
  const {sortBys} = queryParts;
  const meta = result.meta ?? {};

  const columns = useMemo(() => eventView.getColumns(), [eventView]);

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles} = useTableStyles(fields, tableRef, {
    minimumColumnWidth: 50,
    prefixColumnWidth: 'min-content',
  });

  return (
    <Fragment>
      <Table ref={tableRef} styles={initialTableStyles} scrollable height={258}>
        <TableHead>
          <TableRow>
            <TableHeadCell isFirst={false}>
              <TableHeadCellContent />
            </TableHeadCell>
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

              const direction = sortBys.find(s => s.field === field)?.kind;

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <TableHeadCellContent>
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
              const target = getSamplesTargetAtIndex(index, [...queries], row, location);
              return (
                <TableRow key={i}>
                  <TableBodyCell key={`samples-${i}`}>
                    {topEvents && i < topEvents && <TopResultsIndicator index={i} />}
                    <Tooltip title={t('View Samples')} containerDisplayMode="flex">
                      <StyledLink to={target} data-test-id={'unstack-link'}>
                        <IconStack />
                      </StyledLink>
                    </Tooltip>
                  </TableBodyCell>
                  {fields.map((field, j) => {
                    return (
                      <TableBodyCell key={j}>
                        <MultiQueryFieldRenderer
                          index={index}
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
    </Fragment>
  );
}

interface SampleTableProps extends MultiQueryTableProps {
  spansTableResult: SpansTableResult;
}

function SpansTable({spansTableResult, query: queryParts, index}: SampleTableProps) {
  const {result, eventView} = spansTableResult;
  const {fields, sortBys} = queryParts;
  const meta = result.meta ?? {};

  const columnsFromEventView = useMemo(() => eventView.getColumns(), [eventView]);

  const visibleFields = useMemo(
    () => (fields.includes('id') ? fields : ['id', ...fields]),
    [fields]
  );

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles} = useTableStyles(visibleFields, tableRef, {
    minimumColumnWidth: 50,
  });

  return (
    <Fragment>
      <Table ref={tableRef} styles={initialTableStyles} scrollable height={258}>
        <TableHead>
          <TableRow>
            {visibleFields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const tag = stringTags[field] ?? numberTags[field] ?? null;

              const direction = sortBys.find(s => s.field === field)?.kind;
              const label = tag?.name ?? prettifyTagKey(field);

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <TableHeadCellContent>
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
                {visibleFields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      <MultiQueryFieldRenderer
                        index={index}
                        column={columnsFromEventView[j]!}
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
    </Fragment>
  );
}

const TopResultsIndicator = styled('div')<{index: number}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 16px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => {
    return CHART_PALETTE[TOP_EVENTS_LIMIT - 1]![p.index];
  }};
`;

const StyledLink = styled(Link)`
  display: flex;
`;

const TableBodyCell = styled(GridBodyCell)`
  min-height: 30px;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TableHeadCell = styled(GridHeadCell)<{align?: Alignments}>`
  ${p => p.align && `justify-content: ${p.align};`}
  height: 32px;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TableHeadCellContent = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
