import {useCallback, useRef} from 'react';
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
import usePageFilters from 'sentry/utils/usePageFilters';
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
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {getIntervalOptionsForPageFilter} from 'sentry/views/explore/hooks/useChartInterval';
import {HiddenColumnEditorLogFields} from 'sentry/views/explore/logs/constants';
import {LogsGraph} from 'sentry/views/explore/logs/logsGraph';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';
import {usePersistentLogsPageParameters} from 'sentry/views/explore/logs/usePersistentLogsPageParameters';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {PickableDays} from 'sentry/views/explore/utils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

type LogsTabProps = PickableDays;

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
  const pageFilters = usePageFilters();
  usePersistentLogsPageParameters(); // persist the columns you chose last time

  const columnEditorButtonRef = useRef<HTMLButtonElement>(null);
  // always use the smallest interval possible (the most bars)
  const interval = getIntervalOptionsForPageFilter(pageFilters.selection.datetime)?.[0]
    ?.value;
  const timeseriesResult = useSortedTimeSeries(
    {
      search: logsSearch,
      yAxis: [`count(${OurLogKnownFieldKey.MESSAGE})`],
      interval,
    },
    'explore.ourlogs.main-chart',
    DiscoverDatasets.OURLOGS
  );

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
            <StyledPageFilterBar condensed>
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
            </StyledPageFilterBar>
            <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />

            <Button
              onClick={openColumnEditor}
              icon={<IconTable />}
              ref={columnEditorButtonRef}
            >
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
                searchBarWidthOffset={columnEditorButtonRef.current?.clientWidth}
              />
            </SchemaHintsSection>
          </Feature>
          <LogsGraphContainer>
            <LogsGraph timeseriesResult={timeseriesResult} />
          </LogsGraphContainer>
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
  gap: ${space(1)};
  margin-bottom: ${space(1)};
  display: grid;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: minmax(300px, auto) 1fr auto;
  }
`;

const LogsItemContainer = styled('div')`
  flex: 1 1 auto;
  margin-top: ${space(2)};
`;

const LogsGraphContainer = styled(LogsItemContainer)`
  height: 200px;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;
