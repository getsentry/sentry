import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import {MenuItemProps} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertBlueprintCard from 'sentry/views/alerts/blueprints/card';
import AlertProcedureSummary from 'sentry/views/alerts/blueprints/procedures/summary';
import {AlertProcedure} from 'sentry/views/alerts/blueprints/types';
import FilterBar from 'sentry/views/alerts/filterBar';
import AlertHeader from 'sentry/views/alerts/list/header';

function AlertProcedureList() {
  const organization = useOrganization();
  const router = useRouter();
  const location = useLocation();
  const api = useApi();
  const {
    data: procedures = [],
    isLoading,
    refetch,
  } = useApiQuery<AlertProcedure[]>(
    [`/organizations/${organization.slug}/alert-procedures/`],
    {staleTime: 0}
  );

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

  const {name: nameQuery = '', team: teamQuery = ''} = location.query;
  let queryProcedures = procedures;
  if (nameQuery?.length) {
    const nameQueryString =
      typeof nameQuery === 'object' ? JSON.stringify(nameQuery) : nameQuery;
    queryProcedures = queryProcedures.filter(p => p.label.includes(nameQueryString));
  }
  if (teamQuery?.length) {
    const teamQueryArray = typeof teamQuery === 'string' ? [teamQuery] : teamQuery;
    const teamQueryString = teamQueryArray.reduce(
      (str, team) => `${str}team:${team}`,
      ''
    );
    queryProcedures = queryProcedures.filter(p =>
      teamQueryString.includes(p.owner ?? 'unassigned')
    );
  }

  function getActionsForProcedure({id, label}: AlertProcedure) {
    const actions: MenuItemProps[] = [
      {
        key: 'edit',
        label: t('Edit'),
        to: `/organization/${organization.slug}/alerts/procedures/${id}/`,
      },
      {
        key: 'delete',
        label: t('Delete'),
        priority: 'danger',
        onAction: () => {
          openConfirmModal({
            onConfirm: async () => {
              await api.requestPromise(
                `/organizations/${organization.slug}/alert-procedures/${id}/`,
                {method: 'DELETE'}
              );
              await refetch();
            },
            header: <h5>{t('Delete Alert Procedure?')}</h5>,
            message: tct(
              "Are you sure you want to delete '[label]'? All it's associated data will be removed. Alerts/Templates which use this procedure will not be affected.",
              {label}
            ),
            confirmText: t('Delete Alert Procedure'),
            priority: 'danger',
          });
        },
      },
    ];
    return actions;
  }

  return (
    <SentryDocumentTitle title={t('Alert Procedures')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="procedures" />
        <Layout.Body>
          <Layout.Main fullWidth>
            {isLoading ? (
              <LoadingIndicator />
            ) : (
              <div>
                <FilterBar
                  location={location}
                  onChangeFilter={handleChangeFilter}
                  onChangeSearch={handleChangeSearch}
                  hasProjectFilters={false}
                  action={
                    <LinkButton
                      title="Create Alert Procedure"
                      priority="primary"
                      icon={<IconAdd isCircled size="md" />}
                      aria-label="Create Alert Procedure"
                      href={`/organization/${organization.slug}/alerts/procedures/new/`}
                    />
                  }
                />
                <ProcedureItemContainer>
                  {queryProcedures.map(p => (
                    <ProcedureItem key={p.id}>
                      <AlertBlueprintCard
                        title={p.label}
                        description={p.description}
                        actions={getActionsForProcedure(p)}
                        owner={p.owner}
                      >
                        <AlertProcedureSummary procedure={p} />
                      </AlertBlueprintCard>
                    </ProcedureItem>
                  ))}
                </ProcedureItemContainer>
              </div>
            )}
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const ProcedureItemContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: 1fr 1fr;
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 1fr;
  }
`;

const ProcedureItem = styled('div')``;

export default AlertProcedureList;
