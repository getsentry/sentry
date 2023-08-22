import styled from '@emotion/styled';

import {openConfirmModal} from 'sentry/components/confirm';
import {MenuItemProps} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertBlueprintCard from 'sentry/views/alerts/blueprints/card';
import {AlertTemplate} from 'sentry/views/alerts/blueprints/types';

import AlertHeader from '../../list/header';

function AlertTemplateList() {
  const organization = useOrganization();
  const router = useRouter();
  const {data: templates = [], isLoading} = useApiQuery<AlertTemplate[]>(
    [`/organizations/${organization.slug}/alert-templates/`],
    {staleTime: 0}
  );
  return (
    <SentryDocumentTitle title={t('Alert Templates')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="templates" />
        <Layout.Body>
          <Layout.Main fullWidth>
            {isLoading ? (
              <LoadingIndicator />
            ) : (
              <TemplateItemContainer>
                {templates.map(tmpl => (
                  <TemplateItem key={tmpl.id}>
                    <AlertBlueprintCard
                      title={tmpl.name}
                      actions={getActionsForTemplate(tmpl)}
                      owner={tmpl.owner}
                    >
                      test
                    </AlertBlueprintCard>
                  </TemplateItem>
                ))}
              </TemplateItemContainer>
            )}
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function getActionsForTemplate({name}: AlertTemplate) {
  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: t('Edit'),
      // to: editLink,
    },
    {
      key: 'duplicate',
      label: t('Duplicate'),
      // to: duplicateLink,
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      onAction: () => {
        openConfirmModal({
          onConfirm: () => {},
          header: <h5>{t('Delete Alert Procedure?')}</h5>,
          message: tct(
            "Are you sure you want to delete '[name]'? All it's associated data will be removed. Alerts/Templates which use this procedure will not be affected.",
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

const TemplateItemContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: 1fr;
`;

const TemplateItem = styled('div')``;

export default AlertTemplateList;
