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
import AlertTemplateSummary from 'sentry/views/alerts/blueprints/templates/summary';
import {AlertTemplate} from 'sentry/views/alerts/blueprints/types';
import FilterBar from 'sentry/views/alerts/filterBar';
import AlertHeader from 'sentry/views/alerts/list/header';

function AlertTemplateList() {
  const organization = useOrganization();
  const router = useRouter();
  const location = useLocation();
  const api = useApi();
  const {
    data: templates = [],
    isLoading,
    refetch,
  } = useApiQuery<AlertTemplate[]>(
    [`/organizations/${organization.slug}/alert-templates/`],
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
  let queryTemplates = templates;
  if (nameQuery?.length) {
    const nameQueryString =
      typeof nameQuery === 'object' ? JSON.stringify(nameQuery) : nameQuery;
    queryTemplates = queryTemplates.filter(tmpl =>
      tmpl.name.toLowerCase().includes(nameQueryString.toLowerCase())
    );
  }
  if (teamQuery?.length) {
    const teamQueryArray = typeof teamQuery === 'string' ? [teamQuery] : teamQuery;
    const teamQueryString = teamQueryArray.reduce(
      (str, team) => `${str}team:${team}`,
      ''
    );
    queryTemplates = queryTemplates.filter(tmpl =>
      teamQueryString.includes(tmpl.owner ?? 'unassigned')
    );
  }

  function getActionsForTemplate({id, name}: AlertTemplate) {
    const actions: MenuItemProps[] = [
      {
        key: 'edit',
        label: t('Edit'),
        to: `/organizations/${organization.slug}/alerts/templates/${id}/`,
      },
      {
        key: 'delete',
        label: t('Delete'),
        priority: 'danger',
        onAction: () => {
          openConfirmModal({
            onConfirm: async () => {
              await api.requestPromise(
                `/organizations/${organization.slug}/alert-templates/${id}/`,
                {method: 'DELETE'}
              );
              await refetch();
            },
            header: <h5>{t('Delete Alert Template?')}</h5>,
            message: tct(
              "Are you sure you want to delete '[name]'? All it's associated data will be removed. Alerts will be unlinked, but not be affected.",
              {name}
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
    <SentryDocumentTitle title={t('Alert Templates')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="templates" />
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
                      title="Create Alert Template"
                      priority="primary"
                      icon={<IconAdd isCircled size="md" />}
                      aria-label="Create Alert Template"
                      href={`/organizations/${organization.slug}/alerts/templates/new/`}
                    />
                  }
                />
                <TemplateItemContainer>
                  {queryTemplates.map(tmpl => (
                    <TemplateItem key={tmpl.id}>
                      <AlertBlueprintCard
                        title={tmpl.name}
                        description={tmpl.description}
                        actions={getActionsForTemplate(tmpl)}
                        owner={tmpl.owner}
                      >
                        <AlertTemplateSummary template={tmpl} />
                      </AlertBlueprintCard>
                    </TemplateItem>
                  ))}
                </TemplateItemContainer>
              </div>
            )}
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const TemplateItemContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: 1fr 1fr;
`;

const TemplateItem = styled('div')``;

export default AlertTemplateList;
