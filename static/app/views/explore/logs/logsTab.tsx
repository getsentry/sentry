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
import {useSchemaHintsOnLargeScreen} from 'sentry/views/explore/components/schemaHintsDrawer';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHintsUtils/schemaHintsListOrder';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  useLogsFields,
  useLogsSearch,
  useSetLogsFields,
  useSetLogsQuery,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useLogAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {HiddenLogDetailFields} from 'sentry/views/explore/logs/constants';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {DefaultPeriod, MaxPickableDays} from 'sentry/views/explore/utils';

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
  const setFields = useSetLogsFields();
  const tableData = useExploreLogsTable({});
  const isSchemaHintsDrawerOpenOnLargeScreen = useSchemaHintsOnLargeScreen();

  const {attributes: stringTags, isLoading: stringTagsLoading} =
    useTraceItemAttributes('string');
  const {attributes: numberTags, isLoading: numberTagsLoading} =
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
          stringTags={stringTags}
          numberTags={numberTags}
          hiddenKeys={HiddenLogDetailFields}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [fields, setFields, stringTags, numberTags]);
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
            numberAttributes={numberTags}
            stringAttributes={stringTags}
            itemType={TraceItemDataset.LOGS}
          />

          <Button onClick={openColumnEditor} icon={<IconTable />}>
            {t('Edit Table')}
          </Button>
        </FilterBarContainer>
        <Feature features="organizations:traces-schema-hints">
          <SchemaHintsSection
            withSchemaHintsDrawer={isSchemaHintsDrawerOpenOnLargeScreen}
          >
            <SchemaHintsList
              supportedAggregates={[]}
              numberTags={numberTags}
              stringTags={stringTags}
              isLoading={numberTagsLoading || stringTagsLoading}
              exploreQuery={logsSearch.formatString()}
              setExploreQuery={setLogsQuery}
              source={SchemaHintsSources.LOGS}
            />
          </SchemaHintsSection>
        </Feature>
      </Layout.Main>

      <LogsTableContainer fullWidth>
        <LogsTable tableData={tableData} />
      </LogsTableContainer>
    </Layout.Body>
  );
}

const FilterBarContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(1)};
`;

const LogsTableContainer = styled(Layout.Main)`
  margin-top: ${space(1)};
`;
