import {useState} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
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
  const [search, setSearch] = useState(new MutableSearch(''));
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
            initialQuery=""
            searchSource="ourlogs"
            onSearch={query => setSearch(new MutableSearch(query))}
          />
        </FilterBarContainer>
      </Layout.Main>
      <LogsTableContainer fullWidth>
        <LogsTable search={search} />
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
