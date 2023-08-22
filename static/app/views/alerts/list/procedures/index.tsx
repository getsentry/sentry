import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueAlertRuleAction} from 'sentry/types/alerts';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import AlertHeader from '../header';

import AlertProcedureCard from './card';

export interface Procedure {
  id: string;
  is_manual: boolean;
  issue_alert_actions: IssueAlertRuleAction[];
  label: string;
  organization_id: number;
  owner: string | null;
  // [type]:[identifer]
  templates: number[];
}

function AlertProcedureList() {
  const organization = useOrganization();
  const router = useRouter();
  const {data: procedures = [], isLoading} = useApiQuery<Procedure[]>(
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
                    <AlertProcedureCard procedure={p} />
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
