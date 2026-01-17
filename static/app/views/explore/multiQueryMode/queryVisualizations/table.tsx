import {Fragment, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Alignments} from 'sentry/components/tables/gridEditable/sortLink';
import {GridBodyCell, GridHeadCell} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconStack} from 'sentry/icons/iconStack';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  fieldAlignment,
  parseFunction,
  prettifyParsedFunction,
} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {
  TableBody,
  TableHead,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import {Table} from 'sentry/views/explore/multiQueryMode/components/miniTable';
import type {
  useMultiQueryTableAggregateMode,
  useMultiQueryTableSampleMode,
} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTable';
import {
  getSamplesTargetAtIndex,
  useReadQueriesFromLocation,
  type ReadableExploreQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {MultiQueryFieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';

const TABLE_HEIGHT = 258;

interface MultiQueryTableBaseProps {
  confidences: Confidence[];
  index: number;
  mode: Mode;
  query: ReadableExploreQueryParts;
}

interface MultiQueryTableProps extends MultiQueryTableBaseProps {
  aggregatesTableResult: ReturnType<typeof useMultiQueryTableAggregateMode>;
  spansTableResult: ReturnType<typeof useMultiQueryTableSampleMode>;
}

export function MultiQueryTable(props: MultiQueryTableProps) {
  const {spansTableResult, aggregatesTableResult, ...rest} = props;

  return (
    <Fragment>
      {props.mode === Mode.AGGREGATE && (
        <AggregatesTable aggregatesTableResult={aggregatesTableResult} {...rest} />
      )}
      {props.mode === Mode.SAMPLES && (
        <SpansTable spansTableResult={spansTableResult} {...rest} />
      )}
    </Fragment>
  );
}

interface AggregateTableProps extends MultiQueryTableBaseProps {
  aggregatesTableResult: AggregatesTableResult;
}

function AggregatesTable({
  aggregatesTableResult,
  query: queryParts,
  index,
}: AggregateTableProps) {
  const theme = useTheme();
  const location = useLocation();
  const queries = useReadQueriesFromLocation();

  const topEvents = 5;
  const {result, eventView, fields} = aggregatesTableResult;
  const {sortBys} = queryParts;
  const meta = result.meta ?? {};

  const columns = useMemo(() => eventView.getColumns(), [eventView]);

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles} = useTableStyles(fields, tableRef, {
    minimumColumnWidth: 50,
    prefixColumnWidth: 'min-content',
  });

  const numberOfRowsNeedingColor = Math.min(result.data?.length ?? 0, TOP_EVENTS_LIMIT);

  const palette = theme.chart.getColorPalette(numberOfRowsNeedingColor - 1);

  return (
    <Fragment>
      <Table ref={tableRef} style={initialTableStyles} scrollable height={TABLE_HEIGHT}>
        <TableHead>
          <TableRow>
            <TableHeadCell isFirst={false}>
              <Flex align="center" gap="xs" />
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
                  <Flex align="center" gap="xs">
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
                  </Flex>
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
              <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
            </TableStatus>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => {
              const target = getSamplesTargetAtIndex(index, [...queries], row, location);
              return (
                <TableRow key={i}>
                  <TableBodyCell key={`samples-${i}`}>
                    {topEvents && i < topEvents && (
                      <TopResultsIndicator color={palette[i]!} />
                    )}
                    <Tooltip title={t('View Samples')} containerDisplayMode="flex">
                      <StyledLink to={target} data-test-id="unstack-link">
                        <IconStack />
                      </StyledLink>
                    </Tooltip>
                  </TableBodyCell>
                  {fields.map((field, j) => {
                    return (
                      <TableBodyCell key={j}>
                        <MultiQueryFieldRenderer
                          index={index}
                          column={columns[j]}
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

interface SampleTableProps extends MultiQueryTableBaseProps {
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

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles} = useTableStyles(visibleFields, tableRef, {
    minimumColumnWidth: 50,
  });

  return (
    <Fragment>
      <Table ref={tableRef} style={initialTableStyles} scrollable height={TABLE_HEIGHT}>
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
                  <Flex align="center" gap="xs">
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
                  </Flex>
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
              <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
            </TableStatus>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => (
              <TableRow key={i}>
                {visibleFields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      <MultiQueryFieldRenderer
                        index={index}
                        column={columnsFromEventView[j]}
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

const TopResultsIndicator = styled('div')<{color: string}>`
  position: absolute;
  left: -1px;
  width: 8px;
  height: 16px;
  border-radius: 0 2px 2px 0;

  background-color: ${p => p.color};
`;

const StyledLink = styled(Link)`
  display: flex;
`;

const TableBodyCell = styled(GridBodyCell)`
  font-size: ${p => p.theme.fontSize.sm};
  min-height: 12px;
`;

const TableHeadCell = styled(GridHeadCell)<{align?: Alignments}>`
  ${p => p.align && `justify-content: ${p.align};`}
  font-size: ${p => p.theme.fontSize.sm};
  height: 33px;
`;
