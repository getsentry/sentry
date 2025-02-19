import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  useLogsSearch,
  useSetLogsQuery,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
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
  return (
    <Layout.Body>
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
          <SearchQueryBuilder
            placeholder={t('Search for logs')}
            filterKeys={{}}
            getTagValues={() => new Promise<string[]>(() => [])}
            initialQuery={logsSearch.formatString()}
            searchSource="ourlogs"
            onSearch={setLogsQuery}
          />
        </FilterBarContainer>
      </Layout.Main>
      <LogsTableContainer fullWidth>
        <LogsTable search={logsSearch} />
      </LogsTableContainer>
    </Layout.Body>
  );
}

const FilterBarContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const LogsTableContainer = styled(Layout.Main)`
  margin-top: ${space(2)};
`;
