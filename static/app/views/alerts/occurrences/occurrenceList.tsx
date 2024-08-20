import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import FilterBar from 'sentry/views/alerts/filterBar';
import AlertHeader from 'sentry/views/alerts/list/header';
import {OccurrenceListRow} from 'sentry/views/alerts/occurrences/occurrenceListRow';
import {useUpdateEscalationPolicyState} from 'sentry/views/escalationPolicies/mutations/useUpdateEscalationPolicyState';
import {
  type EscalationPolicyStateTypes,
  useFetchEscationPolicyStates,
} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicyStates';

/* COPIED FROM sentry/views/alerts/rules/alertRulesList */
const StyledLoadingError = styled(LoadingError)`
  grid-column: 1 / -1;
  margin-bottom: ${space(4)};
  border-radius: 0;
  border-width: 1px 0;
`;
const StyledPanelTable = styled(PanelTable)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: initial;
  }

  grid-template-columns: minmax(250px, 4fr) auto auto 60px auto;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledSortLink = styled(Link)`
  color: inherit;
  display: flex;
  align-items: center;
  gap: ${space(0.5)};

  :hover {
    color: inherit;
  }
`;

/* END COPY */

function OccurrencesPage() {
  const router = useRouter();
  const organization = useOrganization();
  const location = useLocation();

  const {
    data: escalationPolicyStates = [],
    refetch,
    getResponseHeader,
    isLoading,
    isError,
  } = useFetchEscationPolicyStates({orgSlug: organization.slug}, {});
  const escalationPolicyStatesPageLinks = getResponseHeader?.('Link');

  /* COPIED FROM sentry/views/alerts/rules/alertRulesList */
  type SortField = 'date_added' | 'status';
  const defaultSort: SortField = 'date_added';

  const handleChangeFilter = (activeFilters: string[]) => {
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        team: activeFilters.length > 0 ? activeFilters : '',
      },
    });
  };

  const handleChangeSearch = (name: string) => {
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        name,
      },
    });
  };

  const sort: {asc: boolean; field: SortField} = {
    asc: location.query.asc === '1',
    field: (location.query.sort as SortField) || defaultSort,
  };
  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
  const sortArrow = (
    <IconArrow color="gray300" size="xs" direction={sort.asc ? 'up' : 'down'} />
  );

  /* END COPY */

  const {mutateAsync: updateEscalationPolicyState} = useUpdateEscalationPolicyState({
    onSuccess: () => {
      refetch();
    },
  });

  const handleStatusChange = async (id: number, state: EscalationPolicyStateTypes) => {
    await updateEscalationPolicyState({
      escalationPolicyStateId: id,
      orgSlug: organization.id,
      state: state,
    });

    return id + status;
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Occurrences')} orgSlug={organization.slug} />

      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="occurrences" />
        <Layout.Body>
          <Layout.Main fullWidth>
            <FilterBar
              location={location}
              onChangeFilter={handleChangeFilter}
              onChangeSearch={handleChangeSearch}
            />
            <StyledPanelTable
              isLoading={isLoading}
              isEmpty={escalationPolicyStates.length === 0 && !isError}
              emptyMessage={t('No occurrences found for the current query.')}
              headers={[
                <StyledSortLink
                  key="status"
                  role="columnheader"
                  aria-sort={
                    sort.field !== 'status'
                      ? 'none'
                      : sort.asc
                        ? 'ascending'
                        : 'descending'
                  }
                  to={{
                    pathname: location.pathname,
                    query: {
                      ...currentQuery,
                      // sort by name should start by ascending on first click
                      asc: sort.field === 'status' && sort.asc ? undefined : '1',
                      sort: 'status',
                    },
                  }}
                >
                  {t('Status')} {sort.field === 'status' ? sortArrow : null}
                </StyledSortLink>,

                t('Title'),

                <StyledSortLink
                  key="created"
                  role="columnheader"
                  aria-sort={sort.asc ? 'ascending' : 'descending'}
                  to={{
                    pathname: location.pathname,
                    query: {
                      ...currentQuery,
                      asc: sort.asc ? '1' : undefined,
                      sort: 'date_added',
                    },
                  }}
                >
                  {t('Created')} {sort.field === 'date_added' ? sortArrow : null}
                </StyledSortLink>,

                t('Assigned To'),
                t('Actions'),
              ]}
            >
              {isError ? (
                <StyledLoadingError
                  message={t('There was an error loading alerts.')}
                  onRetry={refetch}
                />
              ) : null}
              <VisuallyCompleteWithData
                id="EscalationPolicyStates-Body"
                hasData={escalationPolicyStates.length > 0}
              >
                {escalationPolicyStates.map(policyState => {
                  return (
                    <OccurrenceListRow
                      key={policyState.id}
                      escalationPolicyState={policyState}
                      onStatusChange={handleStatusChange}
                    />
                  );
                })}
              </VisuallyCompleteWithData>
            </StyledPanelTable>
            <Pagination
              pageLinks={escalationPolicyStatesPageLinks}
              onCursor={(cursor, path, _direction) => {
                router.push({
                  pathname: path,
                  query: {...currentQuery, cursor},
                });
              }}
            />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </Fragment>
  );
}

export default OccurrencesPage;
