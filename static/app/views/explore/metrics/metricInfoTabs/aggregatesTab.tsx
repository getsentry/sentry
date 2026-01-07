import {useEffect, useMemo, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import throttle from 'lodash/throttle';

import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {decodeColumnOrder} from 'sentry/views/discover/utils';
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
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  createTraceMetricFilter,
  getMetricsUnit,
} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useSetQueryParamsAggregateSortBys,
} from 'sentry/views/explore/queryParams/context';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

const RESULT_LIMIT = 50;

interface AggregatesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
}

export function AggregatesTab({traceMetric, isMetricOptionsEmpty}: AggregatesTabProps) {
  const topEvents = useTopEvents();
  const tableRef = useRef<HTMLDivElement>(null);

  const {result, eventView, fields} = useMetricAggregatesTable({
    enabled: Boolean(traceMetric.name) && !isMetricOptionsEmpty,
    limit: RESULT_LIMIT,
    traceMetric,
  });

  const columns = useMemo(
    () => decodeColumnOrder(eventView.fields, result.meta),
    [eventView, result.meta]
  );
  const sorts = useQueryParamsAggregateSortBys();
  const setSorts = useSetQueryParamsAggregateSortBys();
  const groupBys = useQueryParamsGroupBys();

  const traceMetricFilter = createTraceMetricFilter(traceMetric);

  const {attributes: numberTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'number',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
  });
  const {attributes: stringTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
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

  // Detect horizontal scroll to conditionally show sticky column shadow
  useEffect(() => {
    const tableElement = tableRef.current;
    if (!tableElement) {
      return undefined;
    }

    const checkScroll = () => {
      const {scrollWidth, clientWidth, scrollLeft} = tableElement;
      const hasOverflow = scrollWidth > clientWidth;
      // Check if scrolled all the way to the right, use < 1 as threshold to account for precision issues
      const isScrolledFullyRight = Math.abs(scrollLeft + clientWidth - scrollWidth) < 1;

      // Update box-shadow directly on DOM elements (prevents re-renders)
      const shouldShowShadow = hasOverflow && !isScrolledFullyRight;
      tableElement
        .querySelectorAll<HTMLElement>('[data-sticky-column="true"]')
        .forEach(cell => {
          cell.style.boxShadow = shouldShowShadow
            ? '-2px 0px 4px -1px rgba(0, 0, 0, 0.1)'
            : 'none';
        });
      tableElement
        .querySelectorAll<HTMLElement>('[data-sticky-column="false"]')
        .forEach(cell => {
          if (cell.style.boxShadow !== 'none') {
            cell.style.boxShadow = 'none';
          }
        });
    };

    // Throttle scroll handler to avoid calling this too often
    const throttledCheckScroll = throttle(checkScroll, 100, {
      leading: true,
      trailing: true,
    });

    // Check on mount and when content changes
    checkScroll();

    // Listen to scroll events with throttled handler
    tableElement.addEventListener('scroll', throttledCheckScroll);

    // Use ResizeObserver to check when table size changes
    const resizeObserver = new ResizeObserver(throttledCheckScroll);
    resizeObserver.observe(tableElement);

    return () => {
      tableElement.removeEventListener('scroll', throttledCheckScroll);
      throttledCheckScroll.cancel();
      resizeObserver.disconnect();
    };
  }, [result.data, fields.length]);

  const isPending = result.isPending && !isMetricOptionsEmpty;

  return (
    <StickyCompatibleSimpleTable ref={tableRef} style={tableStyle}>
      {isPending && <TransparentLoadingMask />}

      <StickyCompatibleStyledHeader>
        {fields.map((field, i) => {
          let label = field;
          const tag = stringTags?.[field] ?? numberTags?.[field] ?? null;
          const func = parseFunction(field);
          if (func) {
            label = `${func.name}(…)`;
          } else if (tag) {
            label = tag.name;
          } else {
            label = prettifyTagKey(field);
          }

          const direction = sorts.find(s => s.field === field)?.kind;

          function updateSort() {
            const kind = direction === 'desc' ? 'asc' : 'desc';
            setSorts([{field, kind}]);
          }

          return (
            <StickyCompatibleStyledHeaderCell
              key={i}
              divider={!isLastColumn(i)}
              data-sticky-column={isLastColumn(i) ? 'true' : 'false'}
              isSticky={isLastColumn(i)}
              sort={direction}
              handleSortClick={updateSort}
            >
              <Tooltip showOnlyOnOverflow title={label}>
                {label}
              </Tooltip>
            </StickyCompatibleStyledHeaderCell>
          );
        })}
      </StickyCompatibleStyledHeader>

      <StickyCompatibleTableBody>
        {result.isError ? (
          <SimpleTable.Empty>
            <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
          </SimpleTable.Empty>
        ) : result.data?.length ? (
          result.data.map((row, i) => (
            <SimpleTable.Row key={i} style={{minHeight: '33px'}}>
              {topEvents && i < topEvents && (
                <StyledTopResultsIndicator count={topEvents} index={i} />
              )}
              {fields.map((field, j) => (
                <StickyCompatibleStyledRowCell
                  key={j}
                  data-sticky-column={isLastColumn(j) ? 'true' : 'false'}
                  isSticky={isLastColumn(j)}
                  offset={j === 0 ? firstColumnOffset : undefined}
                >
                  <FieldRenderer
                    column={columns[j]}
                    data={row}
                    unit={getMetricsUnit(meta, field)}
                    meta={meta}
                    usePortalOnDropdown
                  />
                </StickyCompatibleStyledRowCell>
              ))}
            </SimpleTable.Row>
          ))
        ) : isPending ? (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        ) : (
          <SimpleTable.Empty>
            <GenericWidgetEmptyStateWarning title={t('No aggregates found')} message="" />
          </SimpleTable.Empty>
        )}
      </StickyCompatibleTableBody>
    </StickyCompatibleSimpleTable>
  );
}

const StickyCompatibleSimpleTable = styled(StyledSimpleTable)`
  overflow: auto;
`;

const StickyCompatibleTableBody = styled(StyledSimpleTableBody)`
  overflow: unset;
`;

const StickyCompatibleStyledHeader = styled(StyledSimpleTableHeader)`
  z-index: 2;
`;

const StickyCompatibleStyledHeaderCell = styled(StyledSimpleTableHeaderCell)<{
  isSticky: boolean;
}>`
  justify-content: ${p => (p.isSticky ? 'flex-end' : 'flex-start')};
  padding: ${p => (p.noPadding ? 0 : p.theme.space.lg)};
  padding-top: ${p => (p.noPadding ? 0 : p.theme.space.xs)};
  padding-bottom: ${p => (p.noPadding ? 0 : p.theme.space.xs)};
  ${p =>
    p.isSticky &&
    css`
      position: sticky;
      right: 0;
      background: ${p.theme.tokens.background.secondary};
      height: 100%;
      z-index: 2;
    `};
`;

const StickyCompatibleStyledRowCell = styled(StyledSimpleTableRowCell)<{
  isSticky: boolean;
  offset?: string;
}>`
  ${p =>
    p.offset &&
    css`
      padding-left: ${p.offset};
    `}
  ${p =>
    p.isSticky &&
    css`
      position: sticky;
      right: 0;
      background: ${p.theme.tokens.background.primary};
      height: 100%;
      z-index: 1;
      justify-self: end;
      width: 100%;
    `};
`;
