import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {IconChevron, IconEdit, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {HOUR} from 'sentry/utils/formatters';
import {useQueryClient, type InfiniteData} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import SchemaHintsList from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
  ExploreControlSection,
  ExploreSchemaHintsSection,
} from 'sentry/views/explore/components/styles';
import {TableActionButton} from 'sentry/views/explore/components/tableActionButton';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {
  useLogsPageData,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {usePersistedLogsPageParams} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  HiddenColumnEditorLogFields,
  HiddenLogSearchFields,
} from 'sentry/views/explore/logs/constants';
import {AutorefreshToggle} from 'sentry/views/explore/logs/logsAutoRefresh';
import {LogsDownSamplingAlert} from 'sentry/views/explore/logs/logsDownsamplingAlert';
import {LogsExportButton} from 'sentry/views/explore/logs/logsExport';
import {LogsGraph} from 'sentry/views/explore/logs/logsGraph';
import {LogsTabSeerComboBox} from 'sentry/views/explore/logs/logsTabSeerComboBox';
import {LogsToolbar} from 'sentry/views/explore/logs/logsToolbar';
import {
  LogsFilterSection,
  LogsGraphContainer,
  LogsItemContainer,
  LogsSidebarCollapseButton,
  LogsTableActionsContainer,
  StyledPageFilterBar,
  TableActionsContainer,
} from 'sentry/views/explore/logs/styles';
import {LogsAggregateTable} from 'sentry/views/explore/logs/tables/logsAggregateTable';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {type OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {useLogsAggregatesTable} from 'sentry/views/explore/logs/useLogsAggregatesTable';
import {getMaxIngestDelayTimestamp} from 'sentry/views/explore/logs/useLogsQuery';
import {useLogsSearchQueryBuilderProps} from 'sentry/views/explore/logs/useLogsSearchQueryBuilderProps';
import {useLogsTimeseries} from 'sentry/views/explore/logs/useLogsTimeseries';
import {usePersistentLogsPageParameters} from 'sentry/views/explore/logs/usePersistentLogsPageParameters';
import {useSaveAsItems} from 'sentry/views/explore/logs/useSaveAsItems';
import {calculateAverageLogsPerSecond} from 'sentry/views/explore/logs/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsSearch,
  useQueryParamsSortBys,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParamsFields,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {useRawCounts} from 'sentry/views/explore/useRawCounts';

// eslint-disable-next-line no-restricted-imports,boundaries/element-types
import QuotaExceededAlert from 'getsentry/components/performance/quotaExceededAlert';

type LogsTabProps = {
  datePageFilterProps: DatePageFilterProps;
};

interface LogsSearchBarProps {
  tracesItemSearchQueryBuilderProps: Parameters<typeof TraceItemSearchQueryBuilder>[0];
}

function LogsSearchBar({tracesItemSearchQueryBuilderProps}: LogsSearchBarProps) {
  const {displayAskSeer} = useSearchQueryBuilder();

  if (displayAskSeer) {
    return <LogsTabSeerComboBox />;
  }

  return <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />;
}

export function LogsTabContent({datePageFilterProps}: LogsTabProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const logsSearch = useQueryParamsSearch();
  const fields = useQueryParamsFields();
  const groupBys = useQueryParamsGroupBys();
  const mode = useQueryParamsMode();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const queryClient = useQueryClient();
  const sortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const setMode = useSetQueryParamsMode();
  const setFields = useSetQueryParamsFields();
  const tableData = useLogsPageDataQueryResult();
  const autorefreshEnabled = useLogsAutoRefreshEnabled();

  // AI search is gated behind the gen-ai-search-agent-translate feature flag
  const areAiFeaturesAllowed =
    !organization?.hideAiFeatures &&
    organization.features.includes('gen-ai-features') &&
    organization.features.includes('gen-ai-search-agent-translate');
  const [timeseriesIngestDelay, setTimeseriesIngestDelay] = useState<bigint>(
    getMaxIngestDelayTimestamp()
  );
  const [_, setPersistentParams] = usePersistedLogsPageParams();
  usePersistentLogsPageParameters(); // persist the columns you chose last time

  const columnEditorButtonRef = useRef<HTMLButtonElement>(null);
  // always use the smallest interval possible (the most bars)
  const [interval] = useChartInterval();
  const visualizes = useQueryParamsVisualizes();

  const [sidebarOpen, setSidebarOpen] = useState(mode === Mode.AGGREGATE);

  useEffect(() => {
    if (autorefreshEnabled) {
      setTimeseriesIngestDelay(getMaxIngestDelayTimestamp());
    }
  }, [autorefreshEnabled]);

  const rawLogCounts = useRawCounts({dataset: DiscoverDatasets.OURLOGS});

  const yAxes = useMemo(() => {
    const uniqueYAxes = new Set(visualizes.map(visualize => visualize.yAxis));
    return [...uniqueYAxes];
  }, [visualizes]);

  const timeseriesResult = useLogsTimeseries({
    enabled: true,
    tableData,
    timeseriesIngestDelay,
  });
  const aggregatesTableResult = useLogsAggregatesTable({
    enabled: mode === Mode.AGGREGATE,
    limit: 50,
  });

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
    interval,
    isTopN: !!topEventsLimit,
    logsAggregatesTableResult: aggregatesTableResult,
    logsTableResult: tableData,
    logsTimeseriesResult: timeseriesResult,
    mode,
    source: LogsAnalyticsPageSource.EXPLORE_LOGS,
    yAxes,
    sortBys,
    aggregateSortBys,
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

  const onColumnsChange = useCallback(
    (newFields: string[]) => {
      setPersistentParams(prev => ({
        ...prev,
        fields: newFields,
      }));
      setFields(newFields);
    },
    [setFields, setPersistentParams]
  );

  const openColumnEditor = useCallback(() => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={fields.slice()}
          onColumnsChange={onColumnsChange}
          stringTags={stringAttributes}
          numberTags={numberAttributes}
          hiddenKeys={HiddenColumnEditorLogFields}
          handleReset={() => {
            onColumnsChange(defaultLogFields());
          }}
          isDocsButtonHidden
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [fields, onColumnsChange, stringAttributes, numberAttributes]);

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
    sortBys: aggregateSortBys,
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

  const {infiniteLogsQueryResult} = useLogsPageData();

  return (
    <SearchQueryBuilderProvider
      enableAISearch={areAiFeaturesAllowed}
      aiSearchBadgeType="alpha"
      {...searchQueryBuilderProviderProps}
    >
      <ExploreBodySearch>
        <Layout.Main width="full">
          <LogsFilterSection>
            <StyledPageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter
                {...datePageFilterProps}
                searchPlaceholder={t('Custom range: 2h, 4d, 3w')}
              />
            </StyledPageFilterBar>
            <LogsSearchBar
              tracesItemSearchQueryBuilderProps={tracesItemSearchQueryBuilderProps}
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
          </LogsFilterSection>
          <ExploreSchemaHintsSection>
            <SchemaHintsList
              supportedAggregates={supportedAggregates}
              numberTags={numberAttributes}
              stringTags={stringAttributes}
              isLoading={numberAttributesLoading || stringAttributesLoading}
              exploreQuery={logsSearch.formatString()}
              source={SchemaHintsSources.LOGS}
              searchBarWidthOffset={columnEditorButtonRef.current?.clientWidth}
            />
          </ExploreSchemaHintsSection>
        </Layout.Main>
      </ExploreBodySearch>

      <ExploreBodyContent>
        <ExploreControlSection expanded={sidebarOpen}>
          {sidebarOpen ? <LogsToolbar /> : null}
        </ExploreControlSection>
        <ExploreContentSection expanded={sidebarOpen}>
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
            <LogsExportButton
              isLoading={tableData.isPending}
              tableData={tableData.data}
              error={tableData.error}
            />
          </OverChartButtonGroup>
          <QuotaExceededAlert referrer="logs-explore" traceItemDataset="logs" />
          <LogsDownSamplingAlert
            timeseriesResult={timeseriesResult}
            tableResult={infiniteLogsQueryResult}
          />
          <LogsGraphContainer>
            <LogsGraph rawLogCounts={rawLogCounts} timeseriesResult={timeseriesResult} />
          </LogsGraphContainer>
          <LogsTableActionsContainer>
            <Tabs value={tableTab} onChange={setTableTab} size="sm">
              <TabList variant="floating">
                <TabList.Item key="logs">{t('Logs')}</TabList.Item>
                <TabList.Item key="aggregates">{t('Aggregates')}</TabList.Item>
              </TabList>
            </Tabs>
            {tableTab === 'logs' && (
              <TableActionsContainer>
                <AutorefreshToggle averageLogsPerSecond={averageLogsPerSecond} />
                <Button
                  size="sm"
                  icon={<IconRefresh />}
                  disabled={canManuallyRefresh ? false : true}
                  onClick={refreshTable}
                  aria-label={t('Refresh')}
                />
                <TableActionButton
                  mobile={
                    <Button
                      onClick={openColumnEditor}
                      icon={<IconEdit />}
                      size="sm"
                      aria-label={t('Edit Table')}
                    />
                  }
                  desktop={
                    <Button
                      onClick={openColumnEditor}
                      icon={<IconEdit />}
                      size="sm"
                      aria-label={t('Edit Table')}
                    >
                      {t('Edit Table')}
                    </Button>
                  }
                />
              </TableActionsContainer>
            )}
          </LogsTableActionsContainer>
          <LogsItemContainer>
            {tableTab === 'logs' ? (
              <LogsInfiniteTable
                stringAttributes={stringAttributes}
                numberAttributes={numberAttributes}
              />
            ) : (
              <LogsAggregateTable aggregatesTableResult={aggregatesTableResult} />
            )}
          </LogsItemContainer>
        </ExploreContentSection>
      </ExploreBodyContent>
    </SearchQueryBuilderProvider>
  );
}
