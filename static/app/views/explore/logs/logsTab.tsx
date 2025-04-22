import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {ExploreCharts} from 'sentry/views/explore/charts';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {
  useLogsFields,
  useLogsSearch,
  useSetLogsFields,
  useSetLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {HiddenColumnEditorLogFields} from 'sentry/views/explore/logs/constants';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {DefaultPeriod, MaxPickableDays} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

type LogsTabProps = {
  defaultPeriod: DefaultPeriod;
  maxPickableDays: MaxPickableDays;
  relativeOptions: Record<string, React.ReactNode>;
};

export function LogsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabProps) {
  const logsSearch = useLogsSearch();
  const fields = useLogsFields();
  const setFields = useSetLogsFields();
  const setLogsPageParams = useSetLogsPageParams();
  const tableData = useExploreLogsTable({});

  const [interval] = useChartInterval();

  const timeseriesResult = useSortedTimeSeries(
    {
      search: logsSearch,
      yAxis: [`count(${OurLogKnownFieldKey.MESSAGE})`],
      interval,
    },
    'explore.ourlogs.main-chart',
    DiscoverDatasets.OURLOGS
  );
  const [visualizes, setVisualizes] = useState<Visualize[]>([
    {
      chartType: ChartType.BAR,
      yAxes: [`count(${OurLogKnownFieldKey.MESSAGE})`],
      label: 'A',
    },
  ]);

  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemAttributes('string');
  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemAttributes('number');

  useLogAnalytics({
    logsTableResult: tableData,
    source: LogsAnalyticsPageSource.EXPLORE_LOGS,
  });

  const tracesItemSearchQueryBuilderProps = {
    initialQuery: logsSearch.formatString(),
    searchSource: 'ourlogs',
    onSearch: (newQuery: string) => {
      const newFields = new MutableSearch(newQuery)
        .getFilterKeys()
        .map(key => (key.startsWith('!') ? key.slice(1) : key));
      const mutableQuery = new MutableSearch(newQuery);
      setLogsPageParams({
        search: mutableQuery,
        fields: [...new Set([...fields, ...newFields])],
      });
    },
    numberAttributes,
    stringAttributes,
    itemType: TraceItemDataset.LOGS as TraceItemDataset.LOGS,
  };

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
      <Layout.Body noRowGap>
        <Layout.Main fullWidth>
          <FilterBarContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter
                defaultPeriod={defaultPeriod}
                maxPickableDays={maxPickableDays}
                relativeOptions={({arbitraryOptions}) => ({
                  ...arbitraryOptions,
                  ...relativeOptions,
                })}
              />
            </PageFilterBar>
            <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />

            <Button onClick={openColumnEditor} icon={<IconTable />}>
              {t('Edit Table')}
            </Button>
          </FilterBarContainer>
          <Feature features="organizations:traces-schema-hints">
            <SchemaHintsSection>
              <SchemaHintsList
                supportedAggregates={[]}
                numberTags={numberAttributes}
                stringTags={stringAttributes}
                isLoading={numberAttributesLoading || stringAttributesLoading}
                exploreQuery={logsSearch.formatString()}
                source={SchemaHintsSources.LOGS}
              />
            </SchemaHintsSection>
          </Feature>
          <Feature features="organizations:ourlogs-graph">
            <LogsItemContainer>
              <ExploreCharts
                canUsePreviousResults
                confidences={['high']}
                query={logsSearch.formatString()}
                timeseriesResult={timeseriesResult}
                visualizes={visualizes}
                setVisualizes={setVisualizes}
                // TODO: we do not support log alerts nor adding to dashboards yet
                hideContextMenu
                dataset={DiscoverDatasets.OURLOGS}
              />
            </LogsItemContainer>
          </Feature>
          <LogsItemContainer>
            <LogsTable
              tableData={tableData}
              stringAttributes={stringAttributes}
              numberAttributes={numberAttributes}
            />
          </LogsItemContainer>
        </Layout.Main>
      </Layout.Body>
    </SearchQueryBuilderProvider>
  );
}

const FilterBarContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(1)};
`;

const LogsItemContainer = styled('div')`
  flex: 1 1 auto;
  margin-top: ${space(2)};
`;
