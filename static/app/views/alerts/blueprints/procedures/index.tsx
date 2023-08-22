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
import AlertProcedureSummary from 'sentry/views/alerts/blueprints/procedures/summary';
import {AlertProcedure} from 'sentry/views/alerts/blueprints/types';

import AlertHeader from '../../list/header';

function AlertProcedureList() {
  const organization = useOrganization();
  const router = useRouter();
  const {data: procedures = [], isLoading} = useApiQuery<AlertProcedure[]>(
    [`/organizations/${organization.slug}/alert-procedures/`],
    {staleTime: 0}
  );

  return (
    <SentryDocumentTitle title={t('Alert Procedures')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="procedures" />
        <Layout.Body>
          <Layout.Main fullWidth>
            {isLoading ? (
              <LoadingIndicator />
            ) : (
              <ProcedureItemContainer>
                {procedures.map(p => (
                  <ProcedureItem key={p.id}>
                    <AlertBlueprintCard
                      title={p.label}
                      actions={getActionsForProcedure(p)}
                      owner={p.owner}
                    >
                      <AlertProcedureSummary procedure={p} />
                    </AlertBlueprintCard>
                  </ProcedureItem>
                ))}
              </ProcedureItemContainer>
            )}
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function getActionsForProcedure({label}: AlertProcedure) {
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
