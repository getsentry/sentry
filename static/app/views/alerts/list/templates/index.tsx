import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueAlertRuleAction, IssueAlertRuleCondition} from 'sentry/types/alerts';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertTemplateCard from 'sentry/views/alerts/list/templates/card';

import AlertHeader from '../header';

export interface Template {
  id: string;
  issue_alert_data: {
    actionMatch: 'all' | 'any' | 'none';
    actions: IssueAlertRuleAction[];
    conditions: IssueAlertRuleCondition[];
    filterMatch: 'all' | 'any' | 'none';
    filters: IssueAlertRuleCondition[];
  };
  issue_alert_ids: number[];
  name: string;
  organization_id: number;
  owner: string | null;
  procedure: number | null;
}

function AlertTemplateList() {
  const organization = useOrganization();
  const router = useRouter();
  const {data: templates = [], isLoading} = useApiQuery<Template[]>(
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
                    <AlertTemplateCard template={tmpl} />
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

const TemplateItemContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: 1fr;
`;

const TemplateItem = styled('div')``;

export default AlertTemplateList;
