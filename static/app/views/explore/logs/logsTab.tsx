import {useCallback, useMemo, useRef, useState} from 'react';

import {openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconChevron, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsAggregate,
  useLogsAggregateFunction,
  useLogsFields,
  useLogsGroupBy,
  useLogsSearch,
  useSetLogsFields,
  useSetLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {HiddenColumnEditorLogFields} from 'sentry/views/explore/logs/constants';
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
import {usePersistentLogsPageParameters} from 'sentry/views/explore/logs/usePersistentLogsPageParameters';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {PickableDays} from 'sentry/views/explore/utils';
import {findSuggestedColumns} from 'sentry/views/explore/utils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

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
  const setFields = useSetLogsFields();
  const setLogsPageParams = useSetLogsPageParams();
  const tableData = useLogsPageDataQueryResult();
  usePersistentLogsPageParameters(); // persist the columns you chose last time

  const oldLogsSearch = usePrevious(logsSearch);

  const columnEditorButtonRef = useRef<HTMLButtonElement>(null);
  // always use the smallest interval possible (the most bars)
  const [interval] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });
  const aggregateFunction = useLogsAggregateFunction();
  const aggregate = useLogsAggregate();
  const [sidebarOpen, setSidebarOpen] = useState(
    !!((aggregateFunction && aggregateFunction !== 'count') || groupBy)
  );
  const timeseriesResult = useSortedTimeSeries(
    {
      search: logsSearch,
      yAxis: [aggregate],
      interval,
      fields: [...(groupBy ? [groupBy] : []), aggregate],
      topEvents: groupBy?.length ? 5 : undefined,
    },
    'explore.ourlogs.main-chart',
    DiscoverDatasets.OURLOGS
  );
  const [tableTab, setTableTab] = useState<'aggregates' | 'logs'>(
    (aggregateFunction && aggregateFunction !== 'count') || groupBy
      ? 'aggregates'
      : 'logs'
  );

  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemAttributes('string');
  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemAttributes('number');

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
                  <AutorefreshToggle />
                </Feature>
                <Button onClick={openColumnEditor} redesign icon={<IconTable redesign />} size="sm">
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
