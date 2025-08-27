import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconChevron, IconRefresh, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {AggregationKey} from 'sentry/utils/fields';
import {HOUR} from 'sentry/utils/formatters';
import {useQueryClient, type InfiniteData} from 'sentry/utils/queryClient';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePageFilters from 'sentry/utils/usePageFilters';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsFields,
  useLogsSearch,
  useSetLogsFields,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {
  HiddenColumnEditorLogFields,
  HiddenLogSearchFields,
} from 'sentry/views/explore/logs/constants';
import {AutorefreshToggle} from 'sentry/views/explore/logs/logsAutoRefresh';
import {LogsGraph} from 'sentry/views/explore/logs/logsGraph';
import {LogsToolbar} from 'sentry/views/explore/logs/logsToolbar';
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
import {LogsAggregateTable} from 'sentry/views/explore/logs/tables/logsAggregateTable';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {
  getIngestDelayFilterValue,
  getMaxIngestDelayTimestamp,
} from 'sentry/views/explore/logs/useLogsQuery';
import {useLogsSearchQueryBuilderProps} from 'sentry/views/explore/logs/useLogsSearchQueryBuilderProps';
import {usePersistentLogsPageParameters} from 'sentry/views/explore/logs/usePersistentLogsPageParameters';
import {useSaveAsItems} from 'sentry/views/explore/logs/useSaveAsItems';
import {useStreamingTimeseriesResult} from 'sentry/views/explore/logs/useStreamingTimeseriesResult';
import {calculateAverageLogsPerSecond} from 'sentry/views/explore/logs/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import type {PickableDays} from 'sentry/views/explore/utils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

type LogsTabProps = PickableDays;

export function LogsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabProps) {
  const pageFilters = usePageFilters();
  const logsSearch = useLogsSearch();
  const fields = useLogsFields();
  const groupBys = useQueryParamsGroupBys();
  const mode = useQueryParamsMode();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const queryClient = useQueryClient();
  const sortBys = useQueryParamsAggregateSortBys();
  const setMode = useSetQueryParamsMode();
  const setFields = useSetLogsFields();
  const tableData = useLogsPageDataQueryResult();
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const [timeseriesIngestDelay, setTimeseriesIngestDelay] = useState<bigint>(
    getMaxIngestDelayTimestamp()
  );
  usePersistentLogsPageParameters(); // persist the columns you chose last time

  const columnEditorButtonRef = useRef<HTMLButtonElement>(null);
  // always use the smallest interval possible (the most bars)
  const [interval] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });
  const visualizes = useQueryParamsVisualizes();

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!sortBys.length) {
      return undefined;
    }

    return sortBys.map(formatSort);
  }, [sortBys]);

  const [sidebarOpen, setSidebarOpen] = useSidebarOpen(
    !!(
      groupBys.some(Boolean) ||
      visualizes.some(
        visualize =>
          isVisualizeFunction(visualize) &&
          visualize.parsedFunction?.name !== AggregationKey.COUNT
      )
    )
  );

  useEffect(() => {
    if (autorefreshEnabled) {
      setTimeseriesIngestDelay(getMaxIngestDelayTimestamp());
    }
  }, [autorefreshEnabled]);

  const search = useMemo(() => {
    const newSearch = logsSearch.copy();
    // We need to add the delay filter to ensure the table data and the graph data are as close as possible when merging buckets.
    newSearch.addFilterValue(
      OurLogKnownFieldKey.TIMESTAMP_PRECISE,
      getIngestDelayFilterValue(timeseriesIngestDelay)
    );
    return newSearch;
  }, [logsSearch, timeseriesIngestDelay]);

  const yAxes = new Set(visualizes.map(visualize => visualize.yAxis));

  const _timeseriesResult = useSortedTimeSeries(
    {
      search,
      yAxis: [...yAxes],
      interval,
      fields: [...groupBys.filter(Boolean), ...yAxes],
      topEvents: topEventsLimit,
      orderby,
    },
    'explore.ourlogs.main-chart',
    DiscoverDatasets.OURLOGS
  );
  const timeseriesResult = useStreamingTimeseriesResult(
    tableData,
    _timeseriesResult,
    timeseriesIngestDelay
  );

  const {
    attributes: stringAttributes,
    isLoading: stringAttributesLoading,
    secondaryAliases: stringSecondaryAliases,
  } = useTraceItemAttributes('string', HiddenLogSearchFields);
  const {
    attributes: numberAttributes,
    isLoading: numberAttributesLoading,
    secondaryAliases: numberSecondaryAliases,
  } = useTraceItemAttributes('number', HiddenLogSearchFields);

  const averageLogsPerSecond = calculateAverageLogsPerSecond(timeseriesResult);

  useLogAnalytics({
    logsTableResult: tableData,
    source: LogsAnalyticsPageSource.EXPLORE_LOGS,
  });

  const {tracesItemSearchQueryBuilderProps, searchQueryBuilderProviderProps} =
    useLogsSearchQueryBuilderProps({
      numberAttributes,
      stringAttributes,
      numberSecondaryAliases,
      stringSecondaryAliases,
    });

  const supportedAggregates = useMemo(() => {
    return [];
  }, []);

  const refreshTable = useCallback(async () => {
    setTimeseriesIngestDelay(getMaxIngestDelayTimestamp());
    queryClient.setQueryData(
      tableData.queryKey,
      (data: InfiniteData<OurLogsResponseItem[]>) => {
        if (data?.pages) {
          // We only want to keep the first page of data to avoid re-fetching multiple pages, since infinite query will otherwise fetch up to max pages (eg. 30) all at once.
          return {
            pages: data.pages.slice(0, 1),
            pageParams: data.pageParams.slice(0, 1),
          };
        }
        return data;
      }
    );
    await tableData.refetch();
  }, [tableData, queryClient]);

  const openColumnEditor = useCallback(() => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={fields}
          onColumnsChange={setFields}
          stringTags={stringAttributes}
          numberTags={numberAttributes}
          hiddenKeys={HiddenColumnEditorLogFields}
          handleReset={() => {
            setFields(defaultLogFields());
          }}
          isDocsButtonHidden
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [fields, setFields, stringAttributes, numberAttributes]);

  const tableTab = mode === Mode.AGGREGATE ? 'aggregates' : 'logs';
  const setTableTab = useCallback(
    (tab: 'aggregates' | 'logs') => {
      if (tab === 'aggregates') {
        setSidebarOpen(true);
        setMode(Mode.AGGREGATE);
      } else {
        setMode(Mode.SAMPLES);
      }
    },
    [setSidebarOpen, setMode]
  );

  const saveAsItems = useSaveAsItems({
    visualizes,
    groupBys,
    interval,
    mode,
    search: logsSearch,
    sortBys,
  });

  /**
   * Manual refresh doesn't work for longer relative periods as it hits cacheing. Only allow manual refresh if the relative period or absolute time range is less than 1 day.
   */
  const canManuallyRefresh = useMemo(() => {
    if (pageFilters.selection.datetime.period) {
      const parsedPeriod = parsePeriodToHours(pageFilters.selection.datetime.period);
      if (parsedPeriod <= 1) {
        return true;
      }
    }

    if (pageFilters.selection.datetime.start && pageFilters.selection.datetime.end) {
      const start = new Date(pageFilters.selection.datetime.start).getTime();
      const end = new Date(pageFilters.selection.datetime.end).getTime();
      const difference = end - start;
      const oneDayInMs = HOUR;
      return difference <= oneDayInMs;
    }

    return false;
  }, [pageFilters.selection.datetime]);

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
              />
            </StyledPageFilterBar>
            <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
            {saveAsItems.length > 0 && (
              <DropdownMenu
                items={saveAsItems}
                trigger={triggerProps => (
                  <Button
                    {...triggerProps}
                    priority="primary"
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
              exploreQuery={logsSearch.formatString()}
              source={SchemaHintsSources.LOGS}
              searchBarWidthOffset={columnEditorButtonRef.current?.clientWidth}
            />
          </SchemaHintsSection>
        </Layout.Main>
      </TopSectionBody>

      <ToolbarAndBodyContainer sidebarOpen={sidebarOpen}>
        {sidebarOpen && (
          <ToolbarContainer sidebarOpen={sidebarOpen}>
            <LogsToolbar stringTags={stringAttributes} numberTags={numberAttributes} />
          </ToolbarContainer>
        )}
        <BottomSectionBody>
          <section>
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
            />
            <LogsGraphContainer>
              <LogsGraph timeseriesResult={timeseriesResult} />
            </LogsGraphContainer>
            <LogsTableActionsContainer>
              <Tabs value={tableTab} onChange={setTableTab} size="sm">
                <TabList hideBorder variant="floating">
                  <TabList.Item key={'logs'}>{t('Logs')}</TabList.Item>
                  <TabList.Item key={'aggregates'}>{t('Aggregates')}</TabList.Item>
                </TabList>
              </Tabs>
              <TableActionsContainer>
                <AutorefreshToggle averageLogsPerSecond={averageLogsPerSecond} />
                <Tooltip
                  title={t(
                    'Narrow your time range to 1hr or less for manually refreshing your logs.'
                  )}
                  disabled={canManuallyRefresh}
                >
                  <Button
                    onClick={refreshTable}
                    icon={<IconRefresh />}
                    size="sm"
                    aria-label={t('Refresh')}
                    disabled={!canManuallyRefresh}
                  />
                </Tooltip>
                <Button onClick={openColumnEditor} icon={<IconTable />} size="sm">
                  {t('Edit Table')}
                </Button>
              </TableActionsContainer>
            </LogsTableActionsContainer>

            <LogsItemContainer>
              {tableTab === 'logs' ? (
                <LogsInfiniteTable
                  stringAttributes={stringAttributes}
                  numberAttributes={numberAttributes}
                />
              ) : (
                <LogsAggregateTable />
              )}
            </LogsItemContainer>
          </section>
        </BottomSectionBody>
      </ToolbarAndBodyContainer>
    </SearchQueryBuilderProvider>
  );
}

function useSidebarOpen(defaultExpanded: boolean) {
  const [sidebarOpen, _setSidebarOpen] = useLocalStorageState(
    'explore-logs-toolbar',
    defaultExpanded ? 'expanded' : ''
  );

  const setSidebarOpen = useCallback(
    (expanded: boolean) => {
      _setSidebarOpen(expanded ? 'expanded' : '');
    },
    [_setSidebarOpen]
  );
  return [sidebarOpen === 'expanded', setSidebarOpen] as const;
}
