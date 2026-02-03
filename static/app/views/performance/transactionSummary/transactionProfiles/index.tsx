import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {TransactionSearchQueryBuilder} from 'sentry/components/performance/transactionSearchQueryBuilder';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {redirectToPerformanceHomepage} from 'sentry/views/performance/transactionSummary/pageLayout';

import {TransactionProfilesContent} from './content';

interface ProfilesProps {
  transaction: string;
}

function Profiles({transaction}: ProfilesProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {projects} = useProjects();

  const project = projects.find(p => p.id === location.query.project);

  const rawQuery = useMemo(
    () => decodeScalar(location.query.query, ''),
    [location.query.query]
  );

  const query = useMemo(() => {
    const conditions = new MutableSearch(rawQuery);
    conditions.setFilterValues('event.type', ['transaction']);
    conditions.setFilterValues('transaction', [transaction]);

    Object.keys(conditions.filters).forEach(field => {
      if (isAggregateField(field)) {
        conditions.removeFilter(field);
      }
    });

    return conditions.formatString();
  }, [transaction, rawQuery]);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchQuery || undefined,
        },
      });
    },
    [location, navigate]
  );

  const projectIds = useMemo(
    () => (project ? [parseInt(project?.id, 10)] : undefined),
    [project]
  );

  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.PROFILE_DURATION, DataCategory.PROFILE_DURATION_UI],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <StyledMain width="full">
      <FilterActions>
        <PageFilterBar condensed>
          <EnvironmentPageFilter />
          <DatePageFilter {...datePageFilterProps} />
        </PageFilterBar>
        <TransactionSearchQueryBuilder
          projects={projectIds}
          initialQuery={rawQuery}
          onSearch={handleSearch}
          searchSource="transaction_profiles"
        />
      </FilterActions>
      <TransactionProfilesContent query={query} transaction={transaction} />
    </StyledMain>
  );
}

const FilterActions = styled('div')`
  margin-bottom: ${space(2)};
  gap: ${space(2)};
  display: grid;
  grid-template-columns: min-content 1fr;
`;

const StyledMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

function ProfilesIndex() {
  const organization = useOrganization();
  const location = useLocation();
  const transaction = decodeScalar(location.query.transaction);

  if (!transaction) {
    redirectToPerformanceHomepage(organization, location);
    return null;
  }

  return <Profiles transaction={transaction} />;
}

export default ProfilesIndex;
