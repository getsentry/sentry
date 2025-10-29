import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
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
import {createMetricNameFilter, getMetricsUnit} from 'sentry/views/explore/metrics/utils';
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
  const theme = useTheme();
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
      gridTemplateColumns:
        groupBys.length > 1
          ? `repeat(${groupBys.length - 1}, auto) auto 1fr`
          : groupBys.length === 1
            ? 'auto 1fr'
            : '1fr',
    };
  }, [groupBys.length]);

  const firstColumnOffset = useMemo(() => {
    return groupBys.length > 0 ? '15px' : '8px';
  }, [groupBys]);

  const isLastColumn = (index: number) => {
    return index === fields.length - 1;
  };

  return (
    <StickyCompatibleSimpleTable style={tableStyle}>
      {result.isPending && <TransparentLoadingMask />}

      <StyledSimpleTableHeader style={{zIndex: 2}}>
        {fields.map((field, i) => {
          let label = field;
          const tag = stringTags?.[field] ?? numberTags?.[field] ?? null;
          if (tag) {
            label = tag.name;
          }

          const func = parseFunction(field);
          if (func) {
            label = `${func.name}(…)`;
          }

          const direction = sorts.find(s => s.field === field)?.kind;

          function updateSort() {
            const kind = direction === 'desc' ? 'asc' : 'desc';
            setSorts([{field, kind}]);
          }

          return (
            <StyledSimpleTableHeaderCell
              key={i}
              divider={!isLastColumn(i)}
              style={{
                justifyContent: func ? 'flex-end' : 'flex-start',
                padding: '0 4px',

                // Sticky styles for last column
                ...(isLastColumn(i) && {
                  position: 'sticky',
                  right: 0,
                  background: theme.bodyBackground,
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                  height: '100%',
                }),
                zIndex: 2,
              }}
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

      <StyledSimpleTableBody style={{overflow: 'unset'}}>
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
                  style={{
                    paddingLeft: j === 0 ? firstColumnOffset : '0px',
                    ...(isLastColumn(j) && {
                      position: 'sticky',
                      right: 0,
                      zIndex: 1,
                      justifySelf: 'end',
                      width: '100%',
                      background: theme.background,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      height: '100%',
                    }),
                  }}
                >
                  <FieldRenderer
                    column={columns[j]}
                    data={row}
                    unit={getMetricsUnit(meta, field)}
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
    </StickyCompatibleSimpleTable>
  );
}

const StickyCompatibleSimpleTable = styled(StyledSimpleTable)`
  overflow: auto;
`;
