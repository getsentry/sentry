import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link/link';
import * as Layout from 'sentry/components/layouts/thirds';
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
import {OccurrenceListRow} from 'sentry/views/alerts/occurrences/occurrenceListRow';
import {useFetchEscationPolicyStates} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicyStates';
import {EscalationPolicyHeaderTabs} from 'sentry/views/settings/organizationEscalationPolicies/escalationPolicyHeaderTabs';

/* COPIED FROM sentry/views/alerts/rules/alertRulesList */
const StyledLoadingError = styled(LoadingError)`
  grid-column: 1 / -1;
  margin-bottom: ${space(4)};
  border-radius: 0;
  border-width: 1px 0;
`;
const StyledPanelTable = styled(PanelTable)`
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    overflow: initial;
  }

  grid-template-columns: 500px 150px auto auto 100px;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSize.md};
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

const SectionTitle = styled('h2')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: ${space(3)} 0 ${space(2)} 0;
  color: ${p => p.theme.headingColor};

  &:first-of-type {
    margin-top: 0;
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

  // Separate occurrences into three categories
  const unacknowledgedOccurrences = escalationPolicyStates.filter(
    state => state.state === 'unacknowledged'
  );
  const acknowledgedOccurrences = escalationPolicyStates.filter(
    state => state.state === 'acknowledged'
  );
  const resolvedOccurrences = escalationPolicyStates.filter(
    state => state.state === 'resolved'
  );

  /* COPIED FROM sentry/views/alerts/rules/alertRulesList */
  type SortField = 'date_added' | 'status';
  const defaultSort: SortField = 'date_added';

  const sort: {asc: boolean; field: SortField} = {
    asc: location.query.asc === '1',
    field: (location.query.sort as SortField) || defaultSort,
  };
  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
  const sortArrow = (
    <IconArrow color="gray300" size="xs" direction={sort.asc ? 'up' : 'down'} />
  );

  /* END COPY */

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Occurrences')} orgSlug={organization.slug} />

      <PageFiltersContainer>
        <EscalationPolicyHeaderTabs activeTab="alerts" />
        <Layout.Body>
          <Layout.Main fullWidth>
            {/* Unacknowledged Occurrences */}
            <SectionTitle>{t('Unacknowledged')}</SectionTitle>
            <StyledPanelTable
              isLoading={isLoading}
              isEmpty={unacknowledgedOccurrences.length === 0 && !isError}
              emptyMessage={t('No unacknowledged alerts found.')}
              headers={[
                t('Title'),
                <StyledSortLink
                  key="status"
                  role="columnheader"
                  aria-sort={
                    sort.field === 'status'
                      ? sort.asc
                        ? 'ascending'
                        : 'descending'
                      : 'none'
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
                id="Unacknowledged-EscalationPolicyStates-Body"
                hasData={unacknowledgedOccurrences.length > 0}
              >
                {unacknowledgedOccurrences.map(policyState => {
                  return (
                    <OccurrenceListRow
                      key={policyState.id}
                      escalationPolicyState={policyState}
                    />
                  );
                })}
              </VisuallyCompleteWithData>
            </StyledPanelTable>

            {/* Acknowledged (Ongoing) Occurrences */}
            <SectionTitle>{t('Ongoing (Acknowledged)')}</SectionTitle>
            <StyledPanelTable
              isLoading={isLoading}
              isEmpty={acknowledgedOccurrences.length === 0 && !isError}
              emptyMessage={t('No acknowledged alerts found.')}
              headers={[
                t('Title'),
                <StyledSortLink
                  key="status-acked"
                  role="columnheader"
                  aria-sort={
                    sort.field === 'status'
                      ? sort.asc
                        ? 'ascending'
                        : 'descending'
                      : 'none'
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

                <StyledSortLink
                  key="created-acked"
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
              <VisuallyCompleteWithData
                id="Acknowledged-EscalationPolicyStates-Body"
                hasData={acknowledgedOccurrences.length > 0}
              >
                {acknowledgedOccurrences.map(policyState => {
                  return (
                    <OccurrenceListRow
                      key={policyState.id}
                      escalationPolicyState={policyState}
                    />
                  );
                })}
              </VisuallyCompleteWithData>
            </StyledPanelTable>

            {/* Resolved Occurrences */}
            <SectionTitle>{t('Resolved')}</SectionTitle>
            <StyledPanelTable
              isLoading={isLoading}
              isEmpty={resolvedOccurrences.length === 0 && !isError}
              emptyMessage={t('No resolved alerts found.')}
              headers={[
                t('Title'),
                <StyledSortLink
                  key="status-resolved"
                  role="columnheader"
                  aria-sort={
                    sort.field === 'status'
                      ? sort.asc
                        ? 'ascending'
                        : 'descending'
                      : 'none'
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

                <StyledSortLink
                  key="created-resolved"
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
              <VisuallyCompleteWithData
                id="Resolved-EscalationPolicyStates-Body"
                hasData={resolvedOccurrences.length > 0}
              >
                {resolvedOccurrences.map(policyState => {
                  return (
                    <OccurrenceListRow
                      key={policyState.id}
                      escalationPolicyState={policyState}
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
