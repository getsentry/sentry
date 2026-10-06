import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconStack} from 'sentry/icons/iconStack';
import {t} from 'sentry/locale';
import {
  fieldAlignment,
  parseFunction,
  prettifyParsedFunction,
} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/topEventsConstants';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
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

const TABLE_HEIGHT = '258px';

interface MultiQueryTableBaseProps {
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

  const {result, eventView, fields} = aggregatesTableResult;
  const {sortBys} = queryParts;
  const meta = result.meta ?? {};

  const columns = useMemo(() => eventView.getColumns(), [eventView]);

  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');

  const numberOfRowsNeedingColor = Math.min(result.data?.length ?? 0, TOP_EVENTS_LIMIT);

  const palette = theme.chart.getColorPalette(numberOfRowsNeedingColor - 1);

  return (
    <Fragment>
      <Table
        variant="results"
        columns={fields.map(field => ({key: field}))}
        height={TABLE_HEIGHT}
        minimumColumnWidth={50}
        prependColumnWidths={['min-content']}
        scrollable
        header={
          <SimpleTable.HeaderRow>
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
              const tag =
                stringTags[field] ?? numberTags[field] ?? booleanTags[field] ?? null;
              if (tag) {
                label = tag.name;
              }

              const func = parseFunction(field);
              if (func) {
                label = prettifyParsedFunction(func);
              }

              const direction = sortBys.find(s => s.field === field)?.kind;

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0} sort={direction}>
                  {label}
                </TableHeadCell>
              );
            })}
          </SimpleTable.HeaderRow>
        }
      >
        {result.isPending ? (
          <SimpleTable.Loading />
        ) : result.isError ? (
          <SimpleTable.Error />
        ) : result.isFetched && result.data?.length ? (
          result.data?.map((row, i) => {
            const target = getSamplesTargetAtIndex(index, [...queries], row, location);
            return (
              <SimpleTable.Row key={i}>
                <TableBodyCell key={`samples-${i}`}>
                  {i < TOP_EVENTS_LIMIT && <TopResultsIndicator color={palette[i]!} />}
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
              </SimpleTable.Row>
            );
          })
        ) : (
          <SimpleTable.Empty>{t('No spans found')}</SimpleTable.Empty>
        )}
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

  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');

  return (
    <Fragment>
      <Table
        variant="results"
        columns={visibleFields.map(field => ({key: field}))}
        height={TABLE_HEIGHT}
        minimumColumnWidth={50}
        scrollable
        header={
          <SimpleTable.HeaderRow>
            {visibleFields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const tag =
                stringTags[field] ?? numberTags[field] ?? booleanTags[field] ?? null;

              const direction = sortBys.find(s => s.field === field)?.kind;
              const label = tag?.name ?? prettifyTagKey(field);

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0} sort={direction}>
                  {label}
                </TableHeadCell>
              );
            })}
          </SimpleTable.HeaderRow>
        }
      >
        {result.isPending ? (
          <SimpleTable.Loading />
        ) : result.isError ? (
          <SimpleTable.Error />
        ) : result.isFetched && result.data?.length ? (
          result.data?.map((row, i) => (
            <SimpleTable.Row key={i}>
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
            </SimpleTable.Row>
          ))
        ) : (
          <SimpleTable.Empty>{t('No spans found')}</SimpleTable.Empty>
        )}
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

const TableBodyCell = styled(SimpleTable.RowCell)`
  font-size: ${p => p.theme.font.size.sm};
  min-height: 12px;
`;

const TableHeadCell = styled(SimpleTable.HeaderCell)`
  font-size: ${p => p.theme.font.size.sm};
  height: 33px;
`;
