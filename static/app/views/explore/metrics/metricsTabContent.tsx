import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconChevron, IconRefresh, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {
  BottomSectionBody,
  FilterBarContainer,
  LogsGraphContainer,
  LogsItemContainer,
  LogsSidebarCollapseButton,
  LogsTableActionsContainer,
  StyledPageFilterBar,
  TableActionsContainer,
  ToolbarAndBodyContainer,
  ToolbarContainer,
  TopSectionBody,
} from 'sentry/views/explore/logs/styles';
import {METRIC_TYPES} from 'sentry/views/explore/metrics/constants';
import {
  isMetricsDashboardsEnabled,
  isMetricsSaveAsQueryEnabled,
} from 'sentry/views/explore/metrics/isMetricsEnabled';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricsGraph';
import {MetricsTab} from 'sentry/views/explore/metrics/metricsTab';
import {useMetricsSearchQueryBuilderProps} from 'sentry/views/explore/metrics/useMetricsSearchQueryBuilderProps';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsSearch,
  useQueryParamsSortBys,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParams,
  useSetQueryParamsFields,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import type {PickableDays} from 'sentry/views/explore/utils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

type MetricsTabContentProps = PickableDays;

export function MetricsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: MetricsTabContentProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const metricsSearch = useQueryParamsSearch();
  const fields = useQueryParamsFields();
  const groupBys = useQueryParamsGroupBys();
  const mode = useQueryParamsMode();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const sortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const setMode = useSetQueryParamsMode();
  const setFields = useSetQueryParamsFields();
  const setQueryParams = useSetQueryParams();
  const visualizes = useQueryParamsVisualizes();

  const [metricName, setMetricName] = useState('');
  const [metricType, setMetricType] = useState<string>('count');
  const [groupByValue, setGroupByValue] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(mode === Mode.AGGREGATE);

  const columnEditorButtonRef = useRef<HTMLButtonElement>(null);

  // always use the smallest interval possible (the most bars)
  const [interval] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!aggregateSortBys.length) {
      return undefined;
    }

    return aggregateSortBys.map(formatSort);
  }, [aggregateSortBys]);

  const {
    attributes: stringAttributes,
    isLoading: stringAttributesLoading,
    secondaryAliases: stringSecondaryAliases,
  } = useTraceItemAttributes('string', []);
  const {
    attributes: numberAttributes,
    isLoading: numberAttributesLoading,
    secondaryAliases: numberSecondaryAliases,
  } = useTraceItemAttributes('number', []);

  const {tracesItemSearchQueryBuilderProps, searchQueryBuilderProviderProps} =
    useMetricsSearchQueryBuilderProps({
      numberAttributes,
      stringAttributes,
      numberSecondaryAliases,
      stringSecondaryAliases,
    });

  const supportedAggregates = useMemo(() => {
    return ['count', 'avg', 'sum', 'max', 'min', 'p50', 'p75', 'p95', 'p99'];
  }, []);

  // Save as items for dropdown
  const saveAsItems = useMemo(() => {
    const items = [];
    if (isMetricsDashboardsEnabled(organization)) {
      items.push({
        key: 'dashboard',
        label: t('Dashboard Widget'),
        onAction: () => {
          // TODO: Implement dashboard save
        },
      });
    }
    if (isMetricsSaveAsQueryEnabled(organization)) {
      items.push({
        key: 'query',
        label: t('Saved Query'),
        onAction: () => {
          // TODO: Implement saved query
        },
      });
    }
    return items;
  }, [organization]);

  // Update search when metric inputs change
  const updateSearchWithMetricInputs = useCallback(() => {
    const currentSearch = new MutableSearch(metricsSearch.formatString());

    // Remove existing metric filters
    currentSearch.removeFilter('metric_name');
    currentSearch.removeFilter('metric_type');

    // Add new filters if values exist
    if (metricName) {
      currentSearch.addFilterValue('metric_name', metricName);
    }
    if (metricType) {
      currentSearch.addFilterValue('metric_type', metricType);
    }

    setQueryParams({
      query: currentSearch.formatString(),
    });
  }, [metricName, metricType, metricsSearch, setQueryParams]);

  // Update search when inputs change
  useEffect(() => {
    updateSearchWithMetricInputs();
  }, [updateSearchWithMetricInputs]);

  const yAxes = useMemo(() => {
    const uniqueYAxes = new Set(visualizes.map(visualize => visualize.yAxis));
    return [...uniqueYAxes];
  }, [visualizes]);

  const timeseriesResult = useSortedTimeSeries(
    {
      search: metricsSearch,
      yAxis: yAxes,
      interval,
      fields: [...groupBys.filter(Boolean), ...yAxes],
      topEvents: topEventsLimit,
      orderby,
    },
    'explore.metrics.main-chart',
    DiscoverDatasets.TRACEMETRICS
  );

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProviderProps}>
      <TopSectionBody noRowGap>
        <Layout.Main fullWidth>
          <FilterBarContainer>
            <StyledPageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter
                defaultPeriod={defaultPeriod}
                maxPickableDays={maxPickableDays}
                relativeOptions={relativeOptions}
                searchPlaceholder={t('Custom range: 2h, 4d, 3w')}
              />
            </StyledPageFilterBar>
            <MetricInputsRow>
              <MetricNameInput
                placeholder={t('Metric Name')}
                value={metricName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setMetricName(e.target.value)
                }
              />
              <CompactSelect
                options={METRIC_TYPES as any}
                value={metricType}
                onChange={(opt: any) => setMetricType(opt.value)}
                triggerProps={{
                  'aria-label': t('Metric Type'),
                }}
              />
              {mode === Mode.AGGREGATE && (
                <GroupByInput
                  placeholder={t('Group By')}
                  value={groupByValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setGroupByValue(e.target.value)
                  }
                />
              )}
            </MetricInputsRow>
            <TraceItemSearchQueryBuilder
              {...tracesItemSearchQueryBuilderProps}
              placeholder={t('Search for metric attributes')}
              searchSource={LogsAnalyticsPageSource.EXPLORE_METRICS}
            />
            {saveAsItems.length > 0 && (
              <DropdownMenu
                items={saveAsItems}
                trigger={triggerProps => (
                  <Button
                    {...triggerProps}
                    priority="default"
                    aria-label={t('Save as')}
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();

                      triggerProps.onClick?.(e);
                    }}
                  >
                    {t('Save as')}
                  </Button>
                )}
              />
            )}
          </FilterBarContainer>
          <SchemaHintsSection>
            <SchemaHintsList
              supportedAggregates={supportedAggregates}
              numberTags={numberAttributes}
              stringTags={stringAttributes}
              isLoading={numberAttributesLoading || stringAttributesLoading}
              exploreQuery={metricsSearch.formatString()}
              source={SchemaHintsSources.METRICS}
              searchBarWidthOffset={columnEditorButtonRef.current?.clientWidth}
            />
          </SchemaHintsSection>
        </Layout.Main>
      </TopSectionBody>

      <ToolbarAndBodyContainer sidebarOpen={sidebarOpen}>
        {sidebarOpen && (
          <ToolbarContainer sidebarOpen={sidebarOpen}>
            {/* TODO: Add metrics toolbar/sidebar */}
            <div>{t('Metrics Sidebar')}</div>
          </ToolbarContainer>
        )}
        <BottomSectionBody sidebarOpen={sidebarOpen}>
          <section>
            <OverChartButtonGroup>
              <LogsSidebarCollapseButton
                sidebarOpen={sidebarOpen}
                aria-label={sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar')}
                size="xs"
                icon={
                  <IconChevron
                    isDouble
                    direction={sidebarOpen ? 'left' : 'right'}
                    size="xs"
                  />
                }
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? null : t('Advanced')}
              </LogsSidebarCollapseButton>
            </OverChartButtonGroup>
            <LogsGraphContainer>
              <MetricsGraph timeseriesResult={timeseriesResult} />
            </LogsGraphContainer>
            <LogsTableActionsContainer>
              <TableActionsContainer>
                {/* TODO: Add table actions */}
              </TableActionsContainer>
            </LogsTableActionsContainer>
            <LogsItemContainer>
              <MetricsTab />
            </LogsItemContainer>
          </section>
        </BottomSectionBody>
      </ToolbarAndBodyContainer>
    </SearchQueryBuilderProvider>
  );
}

const MetricInputsRow = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const MetricNameInput = styled('input')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  width: 200px;

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

const GroupByInput = styled('input')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  width: 200px;

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;
