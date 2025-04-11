import {useCallback} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHintsUtils/schemaHintsListOrder';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {
  type LogPageParamsUpdate,
  useLogsFields,
  useLogsProjectIds,
  useLogsSearch,
  useLogsSortBys,
  useSetLogsFields,
  useSetLogsPageParams,
  useSetLogsQuery,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {HiddenColumnEditorLogFields} from 'sentry/views/explore/logs/constants';
import {LogsChart} from 'sentry/views/explore/logs/logsChart';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {DefaultPeriod, MaxPickableDays} from 'sentry/views/explore/utils';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';

export type LogsTabProps = {
  defaultPeriod: DefaultPeriod;
  maxPickableDays: MaxPickableDays;
  relativeOptions: Record<string, React.ReactNode>;
};

export function LogsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabProps) {
  const setLogsQuery = useSetLogsQuery();
  const logsSearch = useLogsSearch();
  const fields = useLogsFields();
  const sorts = useLogsSortBys();
  const setFields = useSetLogsFields();
  const {selection} = usePageFilters();
  const projectIds = useLogsProjectIds();
  const setLogsPageParams = useSetLogsPageParams();
  const tableData = useExploreLogsTable({});
  const eventView = getEventView(
    logsSearch,
    fields ?? [],
    sorts,
    selection,
    DiscoverDatasets.OURLOGS,
    projectIds
  );

  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemAttributes('string');
  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemAttributes('number');

  useLogAnalytics({
    logsTableResult: tableData,
    source: LogsAnalyticsPageSource.EXPLORE_LOGS,
  });

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
          <TraceItemSearchQueryBuilder
            initialQuery={logsSearch.formatString()}
            searchSource="ourlogs"
            onSearch={setLogsQuery}
            numberAttributes={numberAttributes}
            stringAttributes={stringAttributes}
            itemType={TraceItemDataset.LOGS}
          />

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
              setPageParams={pageParams =>
                setLogsPageParams(pageParams as LogPageParamsUpdate)
              }
              tableColumns={fields}
            />
          </SchemaHintsSection>
        </Feature>
        <Feature features="organizations:ourlogs-graph">
          <LogsItemContainer>
            <LogsChart eventView={eventView} />
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
