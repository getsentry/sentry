import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {useModal} from '@sentry/scraps/modal';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderAI,
} from 'sentry/components/searchQueryBuilder/context';
import {IconChevron, IconEdit, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {HOUR} from 'sentry/utils/formatters';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
  ExploreControlSection,
} from 'sentry/views/explore/components/styles';
import {TableActionButton} from 'sentry/views/explore/components/tableActionButton';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {
  useLogsPageData,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {usePersistedLogsPageParams} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useLogItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {
  HiddenColumnEditorLogFields,
  HiddenLogSearchFields,
} from 'sentry/views/explore/logs/constants';
import {LogsExportModalButton} from 'sentry/views/explore/logs/exports/logsExportModalButton';
import {AutorefreshToggle} from 'sentry/views/explore/logs/logsAutoRefresh';
import {LogsDownSamplingAlert} from 'sentry/views/explore/logs/logsDownsamplingAlert';
import {LogsGraph} from 'sentry/views/explore/logs/logsGraph';
import {LogsSidebarProvider} from 'sentry/views/explore/logs/logsSidebarContext';
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
import {useLogsAggregatesTable} from 'sentry/views/explore/logs/useLogsAggregatesTable';
import {getMaxIngestDelayTimestamp} from 'sentry/views/explore/logs/useLogsQuery';
import {useLogsSearchQueryBuilderProps} from 'sentry/views/explore/logs/useLogsSearchQueryBuilderProps';
import {useLogsTimeseries} from 'sentry/views/explore/logs/useLogsTimeseries';
import {usePersistentLogsPageParameters} from 'sentry/views/explore/logs/usePersistentLogsPageParameters';
import {useSaveAsItems} from 'sentry/views/explore/logs/useSaveAsItems';
import {useValidateLogsTab} from 'sentry/views/explore/logs/useValidateLogsTab';
import {calculateAverageLogsPerSecond} from 'sentry/views/explore/logs/utils';
import type {
  AggregateField,
  WritableAggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsSearch,
  useQueryParamsSortBys,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParamsAggregateFields,
  useSetQueryParamsFields,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useRawCounts} from 'sentry/views/explore/useRawCounts';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

// eslint-disable-next-line boundaries/dependencies
import QuotaExceededAlert from 'getsentry/components/performance/quotaExceededAlert';

type LogsTabProps = {
  datePageFilterProps: DatePageFilterProps;
};

interface LogsSearchBarProps {
  tracesItemSearchQueryBuilderProps: Parameters<typeof TraceItemSearchQueryBuilder>[0];
}

function LogsSearchBar({tracesItemSearchQueryBuilderProps}: LogsSearchBarProps) {
  const {displayAskSeer} = useSearchQueryBuilderAI();

  if (displayAskSeer) {
    return <LogsTabSeerComboBox />;
  }

  return <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />;
}

interface LogsSearchSectionProps {
  datePageFilterProps: DatePageFilterProps;
}

const LogsSearchSection = memo(function LogsSearchSection({
  datePageFilterProps,
}: LogsSearchSectionProps) {
  const logsSearch = useQueryParamsSearch();
  const groupBys = useQueryParamsGroupBys();
  const mode = useQueryParamsMode();
  const [interval] = useChartInterval();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();

  const saveAsItems = useSaveAsItems({
    visualizes,
    groupBys,
    interval,
    mode,
    search: logsSearch,
    sortBys: aggregateSortBys,
  });

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useLogItemAttributes({}, 'string', HiddenLogSearchFields);
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useLogItemAttributes({}, 'number', HiddenLogSearchFields);
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useLogItemAttributes({}, 'boolean', HiddenLogSearchFields);

  const {data: validatedSearchQueryData} = useValidateLogsTab();

  const {tracesItemSearchQueryBuilderProps, searchQueryBuilderProviderProps} =
    useLogsSearchQueryBuilderProps({
      booleanAttributes,
      numberAttributes,
      stringAttributes,
      booleanSecondaryAliases,
      numberSecondaryAliases,
      stringSecondaryAliases,
      validatedSearchQueryData,
    });

  const organization = useOrganization();
  const hasTranslateEndpoint = organization.features.includes(
    'gen-ai-search-agent-translate'
  );

  return (
    <SearchQueryBuilderProvider
      enableAISearch={hasTranslateEndpoint}
      aiSearchBadgeType="beta"
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
                    variant="primary"
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
        </Layout.Main>
      </ExploreBodySearch>
    </SearchQueryBuilderProvider>
  );
});

function LogsTabContentInner({datePageFilterProps}: LogsTabProps) {
  const {openModal} = useModal();
  const organization = useOrganization();

  const pageFilters = usePageFilters();
  const fields = useQueryParamsFields();
  const mode = useQueryParamsMode();
  const groupBys = useQueryParamsGroupBys();
  const aggregateFields = useQueryParamsAggregateFields();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const queryClient = useQueryClient();
  const sortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const setMode = useSetQueryParamsMode();
  const setFields = useSetQueryParamsFields();
  const setAggregateFields = useSetQueryParamsAggregateFields();
  const lastValidatedFieldsCleanupRef = useRef<string | null>(null);
  const tableData = useLogsPageDataQueryResult();
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const searchQuery = useQueryParamsSearch().formatString();
  const visualizes = useQueryParamsVisualizes();

  useLLMContext({
    contextHint:
      'Sentry logs explorer page. Users search log entries by attributes and view samples or aggregates. ' +
      'You can search live telemetry for logs, get detailed log attributes by trace ID, and discover attribute names via the telemetry index.',
    searchQuery,
    mode,
    fields,
    sortBys: sortBys.map(s => (s.kind === 'desc' ? `-${s.field}` : s.field)),
    groupBys: groupBys.filter(g => g !== ''),
    visualizes: visualizes.map(v => v.yAxis),
    currentSelectedDateRange: pageFilters.selection.datetime,
  });

  const [timeseriesIngestDelay, setTimeseriesIngestDelay] = useState(
    getMaxIngestDelayTimestamp()
  );
  const [_, setPersistentParams] = usePersistedLogsPageParams();
  usePersistentLogsPageParameters(); // persist the columns you chose last time

  // always use the smallest interval possible (the most bars)
  const [interval] = useChartInterval();

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

  const {attributes: stringAttributes} = useLogItemAttributes(
    {},
    'string',
    HiddenLogSearchFields
  );
  const {attributes: numberAttributes} = useLogItemAttributes(
    {},
    'number',
    HiddenLogSearchFields
  );
  const {attributes: booleanAttributes} = useLogItemAttributes(
    {},
    'boolean',
    HiddenLogSearchFields
  );
  const {data: validatedColumnsData, isFetching: isValidatingColumns} =
    useValidateLogsTab();
  const {
    validatedAggregateFields,
    validatedBooleanAttributes,
    validatedFieldTypes,
    validatedFields,
    validatedNumberAttributes,
    validatedStringAttributes,
  } = useMemo(
    () =>
      getValidatedColumnEditorData({
        aggregateFields,
        booleanAttributes,
        fields,
        numberAttributes,
        stringAttributes,
        validatedColumnsData,
      }),
    [
      aggregateFields,
      booleanAttributes,
      fields,
      numberAttributes,
      stringAttributes,
      validatedColumnsData,
    ]
  );

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

  const refreshTable = async () => {
    setTimeseriesIngestDelay(getMaxIngestDelayTimestamp());
    queryClient.setQueryData(tableData.queryKey, data => {
      if (data?.pages) {
        // We only want to keep the first page of data to avoid re-fetching multiple pages, since infinite query will otherwise fetch up to max pages (eg. 30) all at once.
        return {
          pages: data.pages.slice(0, 1),
          pageParams: data.pageParams.slice(0, 1),
        };
      }
      return data;
    });
    await tableData.refetch();
  };

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

  useEffect(() => {
    if (isValidatingColumns) {
      return;
    }

    const fieldsChanged =
      validatedFields.length !== fields.length ||
      validatedFields.some((field, index) => field !== fields[index]);

    if (fieldsChanged) {
      const nextFields = [...validatedFields];
      const cleanupKey = nextFields.join('\0');

      if (lastValidatedFieldsCleanupRef.current !== cleanupKey) {
        lastValidatedFieldsCleanupRef.current = cleanupKey;
        setPersistentParams(prev => ({
          ...prev,
          fields: nextFields,
        }));
        setFields(nextFields);
      }
    } else {
      lastValidatedFieldsCleanupRef.current = null;
    }
  }, [fields, isValidatingColumns, setFields, setPersistentParams, validatedFields]);

  useEffect(() => {
    if (mode !== Mode.AGGREGATE || isValidatingColumns) {
      return;
    }

    const aggregateFieldsChanged =
      validatedAggregateFields.length !== aggregateFields.length ||
      validatedAggregateFields.some((aggregateField, index) => {
        const currentAggregateField = aggregateFields[index];
        if (!currentAggregateField) {
          return true;
        }
        if (isGroupBy(aggregateField) && isGroupBy(currentAggregateField)) {
          return aggregateField.groupBy !== currentAggregateField.groupBy;
        }
        if (!isGroupBy(aggregateField) && !isGroupBy(currentAggregateField)) {
          return aggregateField.yAxis !== currentAggregateField.yAxis;
        }
        return true;
      });

    if (aggregateFieldsChanged) {
      setAggregateFields(validatedAggregateFields.map(serializeAggregateField));
    }
  }, [
    aggregateFields,
    isValidatingColumns,
    mode,
    setAggregateFields,
    validatedAggregateFields,
  ]);

  const openColumnEditor = () => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={validatedFields.slice()}
          onColumnsChange={onColumnsChange}
          stringTags={validatedStringAttributes}
          numberTags={validatedNumberAttributes}
          booleanTags={validatedBooleanAttributes}
          validatedFieldTypes={validatedFieldTypes}
          hiddenKeys={HiddenColumnEditorLogFields}
          traceItemType={TraceItemDataset.LOGS}
          handleReset={() => {
            onColumnsChange(defaultLogFields());
          }}
          isDocsButtonHidden
        />
      ),
      {closeEvents: 'escape-key'}
    );
  };

  const tableTab = mode === Mode.AGGREGATE ? 'aggregates' : 'logs';
  const setTableTab = (tab: 'aggregates' | 'logs') => {
    trackAnalytics('logs.explorer.table_tab_changed', {organization, tab});
    if (tab === 'aggregates') {
      setSidebarOpen(true);
      setMode(Mode.AGGREGATE);
    } else {
      setMode(Mode.SAMPLES);
    }
  };

  /**
   * Manual refresh doesn't work for longer relative periods as it hits cacheing.
   * Only allow manual refresh if the relative period or absolute time range is less than 1 hour,
   * or if auto-refresh is disabled.
   */
  const {canManuallyRefresh, manualRefreshDisabledReason} = useMemo(() => {
    if (autorefreshEnabled) {
      return {
        canManuallyRefresh: false,
        manualRefreshDisabledReason: t(
          'Auto-refresh is enabled. Please disable auto-refresh to manually refresh the table.'
        ),
      };
    }
    if (pageFilters.selection.datetime.period) {
      const parsedPeriod = parsePeriodToHours(pageFilters.selection.datetime.period);
      if (parsedPeriod <= 1) {
        return {canManuallyRefresh: true, manualRefreshDisabledReason: null};
      }
      return {
        canManuallyRefresh: false,
        manualRefreshDisabledReason: t(
          'Manual refresh is only available for time ranges of 1 hour or less.'
        ),
      };
    }

    if (pageFilters.selection.datetime.start && pageFilters.selection.datetime.end) {
      const start = new Date(pageFilters.selection.datetime.start).getTime();
      const end = new Date(pageFilters.selection.datetime.end).getTime();
      const difference = end - start;
      const oneHourInMs = HOUR;
      if (difference <= oneHourInMs) {
        return {canManuallyRefresh: true, manualRefreshDisabledReason: null};
      }
      return {
        canManuallyRefresh: false,
        manualRefreshDisabledReason: t(
          'Manual refresh is only available for time ranges of 1 hour or less.'
        ),
      };
    }

    return {
      canManuallyRefresh: false,
      manualRefreshDisabledReason: t(
        'Manual refresh is only available for time ranges of 1 hour or less.'
      ),
    };
  }, [pageFilters.selection.datetime, autorefreshEnabled]);

  const {infiniteLogsQueryResult} = useLogsPageData();

  return (
    <LogsSidebarProvider value={setSidebarOpen}>
      <LogsSearchSection datePageFilterProps={datePageFilterProps} />
      <ViewportConstrainedPage constrained={mode === Mode.SAMPLES} hideFooter>
        <ViewportConstrainedBody>
          <LogsControlSection expanded={sidebarOpen}>
            {sidebarOpen ? <LogsToolbar /> : null}
          </LogsControlSection>
          <ExploreContentSection gap="md">
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
              <LogsExportModalButton
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
              <LogsGraph
                rawLogCounts={rawLogCounts}
                timeseriesResult={timeseriesResult}
              />
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
                  <Tooltip
                    title={manualRefreshDisabledReason}
                    disabled={!manualRefreshDisabledReason}
                    skipWrapper
                  >
                    <Button
                      size="sm"
                      icon={<IconRefresh />}
                      disabled={!canManuallyRefresh}
                      onClick={refreshTable}
                      aria-label={t('Refresh')}
                    />
                  </Tooltip>
                  <TableActionButton
                    mobile={
                      <Button
                        disabled={isValidatingColumns}
                        onClick={openColumnEditor}
                        icon={<IconEdit />}
                        size="sm"
                        aria-label={t('Edit Table')}
                      />
                    }
                    desktop={
                      <Button
                        disabled={isValidatingColumns}
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
            <LogsItemContainer minHeight="max(25vh, 20rem)" overflowX="auto">
              {tableTab === 'logs' ? (
                <LogsInfiniteTable
                  analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
                  booleanAttributes={validatedBooleanAttributes}
                  stringAttributes={validatedStringAttributes}
                  numberAttributes={validatedNumberAttributes}
                  validatedFieldTypes={validatedFieldTypes}
                />
              ) : (
                <LogsAggregateTable
                  aggregatesTableResult={aggregatesTableResult}
                  validatedFieldTypes={validatedFieldTypes}
                />
              )}
            </LogsItemContainer>
          </ExploreContentSection>
        </ViewportConstrainedBody>
      </ViewportConstrainedPage>
    </LogsSidebarProvider>
  );
}

export const LogsTabContent = registerLLMContext('logs-explorer', LogsTabContentInner);

function getValidatedColumnEditorData({
  aggregateFields,
  booleanAttributes,
  fields,
  numberAttributes,
  stringAttributes,
  validatedColumnsData,
}: {
  aggregateFields: readonly AggregateField[];
  booleanAttributes: TagCollection;
  fields: readonly string[];
  numberAttributes: TagCollection;
  stringAttributes: TagCollection;
  validatedColumnsData?: EventValidationData;
}) {
  const validatedBooleanAttributes = {...booleanAttributes};
  const validatedFieldTypes: Partial<Record<string, FieldValueType>> = {};
  const validatedNumberAttributes = {...numberAttributes};
  const validatedStringAttributes = {...stringAttributes};
  const invalidFields = new Set<string>();

  for (const item of validatedColumnsData?.field ?? []) {
    if (!item.name) {
      continue;
    }

    if (!item.valid) {
      invalidFields.add(item.name);
      continue;
    }

    if (item.attrType === 'boolean') {
      validatedFieldTypes[item.name] = FieldValueType.BOOLEAN;
      delete validatedNumberAttributes[item.name];
      delete validatedStringAttributes[item.name];
      validatedBooleanAttributes[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.BOOLEAN,
      };
    }

    if (item.attrType === 'number') {
      validatedFieldTypes[item.name] = FieldValueType.NUMBER;
      delete validatedBooleanAttributes[item.name];
      delete validatedStringAttributes[item.name];
      validatedNumberAttributes[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.MEASUREMENT,
      };
    }

    if (item.attrType === 'string') {
      validatedFieldTypes[item.name] = FieldValueType.STRING;
      delete validatedBooleanAttributes[item.name];
      delete validatedNumberAttributes[item.name];
      validatedStringAttributes[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.TAG,
      };
    }
  }

  return {
    validatedAggregateFields: getValidatedAggregateFields({
      aggregateFields,
      invalidFields,
    }),
    validatedBooleanAttributes,
    validatedFieldTypes,
    validatedFields: fields.filter(field => !invalidFields.has(field)),
    validatedNumberAttributes,
    validatedStringAttributes,
  };
}

export function getValidatedAggregateFields({
  aggregateFields,
  invalidFields,
}: {
  aggregateFields: readonly AggregateField[];
  invalidFields: ReadonlySet<string>;
}): AggregateField[] {
  return aggregateFields.filter(aggregateField => {
    if (isGroupBy(aggregateField)) {
      return !invalidFields.has(aggregateField.groupBy);
    }

    if (invalidFields.has(aggregateField.yAxis)) {
      return false;
    }

    return !parseFunction(aggregateField.yAxis)?.arguments.some(
      argument => argument && invalidFields.has(argument)
    );
  });
}

function serializeAggregateField(aggregateField: AggregateField): WritableAggregateField {
  if (isGroupBy(aggregateField)) {
    return aggregateField;
  }
  return aggregateField.serialize();
}

const ViewportConstrainedBody = styled(ExploreBodyContent)`
  flex-direction: row;
  min-height: 0;
`;

const LogsControlSection = styled(ExploreControlSection)`
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: none;
  }
`;
