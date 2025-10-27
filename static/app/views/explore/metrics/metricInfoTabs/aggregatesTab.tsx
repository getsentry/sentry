import {useMemo} from 'react';

import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {
  StyledSimpleTable,
  StyledSimpleTableBody,
  StyledSimpleTableHeader,
  StyledSimpleTableHeaderCell,
  StyledSimpleTableRowCell,
  StyledTopResultsIndicator,
  TransparentLoadingMask,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {createMetricNameFilter} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useSetQueryParamsAggregateSortBys,
} from 'sentry/views/explore/queryParams/context';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceItemDataset} from 'sentry/views/explore/types';

const RESULT_LIMIT = 50;

interface AggregatesTabProps {
  metricName: string;
}

export function AggregatesTab({metricName}: AggregatesTabProps) {
  const topEvents = useTopEvents();

  const {result, eventView, fields} = useMetricAggregatesTable({
    enabled: Boolean(metricName),
    limit: RESULT_LIMIT,
    metricName,
  });

  const columns = useMemo(() => eventView.getColumns(), [eventView]);
  const sorts = useQueryParamsAggregateSortBys();
  const setSorts = useSetQueryParamsAggregateSortBys();
  const groupBys = useQueryParamsGroupBys();

  const metricNameFilter = createMetricNameFilter(metricName);

  const {attributes: numberTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'number',
    enabled: Boolean(metricNameFilter),
    query: metricNameFilter,
  });
  const {attributes: stringTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
    enabled: Boolean(metricNameFilter),
    query: metricNameFilter,
  });

  const meta = result.meta ?? {};

  const tableStyle = useMemo(() => {
    return {
      gridTemplateColumns: `repeat(${fields.length - 1}, min-content) 1fr`,
    };
  }, [fields]);

  const firstColumnOffset = useMemo(() => {
    return groupBys.length > 0 ? '15px' : '8px';
  }, [groupBys]);

  return (
    <StyledSimpleTable style={tableStyle}>
      {result.isPending && <TransparentLoadingMask />}

      <StyledSimpleTableHeader>
        {fields.map((field, i) => {
          let label = field;
          const tag = stringTags?.[field] ?? numberTags?.[field] ?? null;
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
            <StyledSimpleTableHeaderCell
              key={i}
              style={{paddingLeft: i === 0 ? firstColumnOffset : '0px'}}
              sort={direction}
              handleSortClick={updateSort}
            >
              <Tooltip showOnlyOnOverflow title={label}>
                {label}
              </Tooltip>
            </StyledSimpleTableHeaderCell>
          );
        })}
      </StyledSimpleTableHeader>

      <StyledSimpleTableBody>
        {result.isError ? (
          <SimpleTable.Empty>
            <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
          </SimpleTable.Empty>
        ) : result.data?.length ? (
          result.data.map((row, i) => (
            <SimpleTable.Row key={i} style={{minHeight: '33px'}}>
              {topEvents && i < topEvents && (
                <StyledTopResultsIndicator count={topEvents} index={i} />
              )}
              {fields.map((field, j) => (
                <StyledSimpleTableRowCell
                  key={j}
                  hasPadding
                  style={{paddingLeft: j === 0 ? firstColumnOffset : '0px'}}
                >
                  <FieldRenderer
                    column={columns[j]}
                    data={row}
                    unit={meta?.units?.[field]}
                    meta={meta}
                  />
                </StyledSimpleTableRowCell>
              ))}
            </SimpleTable.Row>
          ))
        ) : result.isPending ? (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        ) : (
          <SimpleTable.Empty>
            <EmptyStateWarning>
              <p>{t('No aggregates found')}</p>
            </EmptyStateWarning>
          </SimpleTable.Empty>
        )}
      </StyledSimpleTableBody>
    </StyledSimpleTable>
  );
}
