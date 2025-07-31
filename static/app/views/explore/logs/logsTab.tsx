import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconChevron, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAggregate,
  useLogsAggregateFunction,
  useLogsAggregateSortBys,
  useLogsFields,
  useLogsGroupBy,
  useLogsMode,
  useLogsSearch,
  useSetLogsFields,
  useSetLogsMode,
  useSetLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
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
  TopSectionBody,
} from 'sentry/views/explore/logs/styles';
import {LogsAggregateTable} from 'sentry/views/explore/logs/tables/logsAggregateTable';
import {LogsInfiniteTable as LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {LogsTable} from 'sentry/views/explore/logs/tables/logsTable';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  getIngestDelayFilterValue,
  getMaxIngestDelayTimestamp,
} from 'sentry/views/explore/logs/useLogsQuery';
import {usePersistentLogsPageParameters} from 'sentry/views/explore/logs/usePersistentLogsPageParameters';
import {useStreamingTimeseriesResult} from 'sentry/views/explore/logs/useStreamingTimeseriesResult';
import {calculateAverageLogsPerSecond} from 'sentry/views/explore/logs/utils';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {PickableDays} from 'sentry/views/explore/utils';
import {findSuggestedColumns} from 'sentry/views/explore/utils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

type LogsTabProps = PickableDays;

export function LogsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabProps) {
  const organization = useOrganization();
  const logsSearch = useLogsSearch();
  const fields = useLogsFields();
  const groupBy = useLogsGroupBy();
  const mode = useLogsMode();
  const sortBys = useLogsAggregateSortBys();
  const setMode = useSetLogsMode();
  const setFields = useSetLogsFields();
  const setLogsPageParams = useSetLogsPageParams();
  const tableData = useLogsPageDataQueryResult();
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const [timeseriesIngestDelay, setTimeseriesIngestDelay] = useState<bigint>(
    getMaxIngestDelayTimestamp()
  );
  usePersistentLogsPageParameters(); // persist the columns you chose last time

  const oldLogsSearch = usePrevious(logsSearch);

  const columnEditorButtonRef = useRef<HTMLButtonElement>(null);
  // always use the smallest interval possible (the most bars)
  const [interval] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });
  const aggregateFunction = useLogsAggregateFunction();
  const aggregate = useLogsAggregate();

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!sortBys.length) {
      return undefined;
    }

    return sortBys.map(formatSort);
  }, [sortBys]);

  const [sidebarOpen, setSidebarOpen] = useState(
    !!((aggregateFunction && aggregateFunction !== 'count') || groupBy)
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

  const _timeseriesResult = useSortedTimeSeries(
    {
      search,
      yAxis: [aggregate],
      interval,
      fields: [...(groupBy ? [groupBy] : []), aggregate],
      topEvents: groupBy ? TOP_EVENTS_LIMIT : undefined,
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

  const onSearch = useCallback(
    (newQuery: string) => {
      const newSearch = new MutableSearch(newQuery);
      const suggestedColumns = findSuggestedColumns(newSearch, oldLogsSearch, {
        numberAttributes,
        stringAttributes,
      });

      const existingFields = new Set(fields);
      const newColumns = suggestedColumns.filter(col => !existingFields.has(col));

      setLogsPageParams({
        search: newSearch,
        fields: newColumns.length ? [...fields, ...newColumns] : undefined,
      });
    },
    [oldLogsSearch, numberAttributes, stringAttributes, fields, setLogsPageParams]
  );

  const tracesItemSearchQueryBuilderProps = {
    initialQuery: logsSearch.formatString(),
    searchSource: 'ourlogs',
    onSearch,
    numberAttributes,
    stringAttributes,
    itemType: TraceItemDataset.LOGS as TraceItemDataset.LOGS,
    numberSecondaryAliases,
    stringSecondaryAliases,
  };

  const supportedAggregates = useMemo(() => {
    return [];
  }, []);

  const searchQueryBuilderProps = useSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

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
      setMode(tab === 'aggregates' ? Mode.AGGREGATE : Mode.SAMPLES);
    },
    [setMode]
  );

  const saveAsItems = useSaveAsItems({
    aggregate,
    groupBy,
    interval,
    mode,
    search: logsSearch,
    sortBys,
  });

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
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
          <LogsToolbar stringTags={stringAttributes} numberTags={numberAttributes} />
        )}
        <BottomSectionBody>
          <section>
            <Feature features="organizations:ourlogs-visualize-sidebar">
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
                onClick={() => setSidebarOpen(x => !x)}
              />
            </Feature>
            <LogsGraphContainer>
              <LogsGraph timeseriesResult={timeseriesResult} />
            </LogsGraphContainer>
            <LogsTableActionsContainer>
              <Feature
                features="organizations:ourlogs-visualize-sidebar"
                renderDisabled={() => <div />}
              >
                <Tabs value={tableTab} onChange={setTableTab} size="sm">
                  <TabList hideBorder variant="floating">
                    <TabList.Item key={'logs'}>{t('Logs')}</TabList.Item>
                    <TabList.Item key={'aggregates'}>{t('Aggregates')}</TabList.Item>
                  </TabList>
                </Tabs>
              </Feature>
              <TableActionsContainer>
                <Feature features="organizations:ourlogs-live-refresh">
                  <AutorefreshToggle
                    disabled={tableTab === 'aggregates'}
                    averageLogsPerSecond={averageLogsPerSecond}
                  />
                </Feature>
                <Button onClick={openColumnEditor} icon={<IconTable />} size="sm">
                  {t('Edit Table')}
                </Button>
              </TableActionsContainer>
            </LogsTableActionsContainer>

            <LogsItemContainer>
              {tableTab === 'logs' &&
              organization.features.includes('ourlogs-infinite-scroll') ? (
                <LogsInfiniteTable
                  stringAttributes={stringAttributes}
                  numberAttributes={numberAttributes}
                />
              ) : tableTab === 'logs' ? (
                <LogsTable
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

interface UseSaveAsItemsOptions {
  aggregate: string;
  groupBy: string | undefined;
  interval: string;
  mode: Mode;
  search: MutableSearch;
  sortBys: Sort[];
}

function useSaveAsItems({
  aggregate,
  groupBy,
  interval,
  mode,
  search,
  sortBys,
}: UseSaveAsItemsOptions) {
  const location = useLocation();
  const router = useRouter();
  const organization = useOrganization();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

  const aggregates = useMemo(() => [aggregate], [aggregate]);

  const saveAsAlert = useMemo(() => {
    const alertsUrls = aggregates.map((yAxis: string, index: number) => {
      const func = parseFunction(yAxis);
      const label = func ? prettifyParsedFunction(func) : yAxis;
      return {
        key: `${yAxis}-${index}`,
        label,
        to: getAlertsUrl({
          project,
          query: search.formatString(),
          pageFilters: pageFilters.selection,
          aggregate: yAxis,
          organization,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          interval,
          eventTypes: 'trace_item_log',
        }),
        onAction: () => {
          trackAnalytics('logs.save_as', {
            save_type: 'alert',
            ui_source: 'searchbar',
            organization,
          });
        },
      };
    });

    return {
      key: 'create-alert',
      label: t('An Alert for'),
      textValue: t('An Alert for'),
      children: alertsUrls ?? [],
      disabled: !alertsUrls || alertsUrls.length === 0,
      isSubmenu: true,
    };
  }, [aggregates, interval, organization, pageFilters, project, search]);

  const saveAsDashboard = useMemo(() => {
    const dashboardsUrls = aggregates.map((yAxis: string, index: number) => {
      const func = parseFunction(yAxis);
      const label = func ? prettifyParsedFunction(func) : yAxis;

      return {
        key: String(index),
        label,
        onAction: () => {
          trackAnalytics('logs.save_as', {
            save_type: 'dashboard',
            ui_source: 'searchbar',
            organization,
          });

          const fields =
            mode === Mode.SAMPLES
              ? []
              : [...new Set([groupBy, yAxis, ...sortBys.map(sort => sort.field)])].filter(
                  defined
                );

          const discoverQuery: NewQuery = {
            name: DEFAULT_WIDGET_NAME,
            fields,
            orderby: sortBys.map(formatSort),
            query: search.formatString(),
            version: 2,
            dataset: DiscoverDatasets.OURLOGS,
            yAxis: [yAxis],
          };

          const eventView = EventView.fromNewQueryWithPageFilters(
            discoverQuery,
            pageFilters.selection
          );
          // the chart currently track the chart type internally so force bar type for now
          eventView.display = DisplayType.BAR;

          handleAddQueryToDashboard({
            organization,
            location,
            eventView,
            router,
            yAxis: eventView.yAxis,
            widgetType: WidgetType.LOGS,
            source: DashboardWidgetSource.LOGS,
          });
        },
      };
    });

    return {
      key: 'add-to-dashboard',
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('A Dashboard widget')}</DisabledText>}
        >
          {t('A Dashboard widget')}
        </Feature>
      ),
      textValue: t('A Dashboard widget'),
      children: dashboardsUrls,
      disabled: !dashboardsUrls || dashboardsUrls.length === 0,
      isSubmenu: true,
    };
  }, [
    aggregates,
    groupBy,
    mode,
    organization,
    pageFilters,
    search,
    sortBys,
    location,
    router,
  ]);

  return useMemo(() => {
    const saveAs = [];
    if (organization.features.includes('ourlogs-alerts')) {
      saveAs.push(saveAsAlert);
    }
    if (organization.features.includes('ourlogs-dashboards')) {
      saveAs.push(saveAsDashboard);
    }
    return saveAs;
  }, [organization, saveAsAlert, saveAsDashboard]);
}

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;
