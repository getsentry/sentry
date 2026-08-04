import {useCallback, useMemo} from 'react';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import type {Group} from 'sentry/types/group';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssueListContainer} from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';
import {BreachedMetricInvestigationAction} from 'sentry/views/issueList/pages/breachedMetricInvestigationAction';
import {BreachedMetricInvestigationStore} from 'sentry/views/issueList/pages/breachedMetricInvestigationStore';
import {ISSUE_TAXONOMY_CONFIG, IssueTaxonomy} from 'sentry/views/issueList/taxonomies';

const CONFIG = ISSUE_TAXONOMY_CONFIG[IssueTaxonomy.BREACHED_METRICS];
const QUERY = `is:unresolved issue.category:[${CONFIG.categories.join(',')}]`;

export default function RegressionsPage() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const investigationStore = useMemo(
    () => new BreachedMetricInvestigationStore(organization.slug, path => navigate(path)),
    [navigate, organization.slug]
  );
  const investigationsEnabled =
    organization.features.includes('investigations') &&
    organization.features.includes('investigations-query-execution');
  const renderGroupAction = useCallback(
    (group: Group) =>
      investigationsEnabled ? (
        <BreachedMetricInvestigationAction
          groupId={group.id}
          store={investigationStore}
        />
      ) : null,
    [investigationStore, investigationsEnabled]
  );

  return (
    <IssueListContainer title={CONFIG.label}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <IssueListOverview
            initialQuery={QUERY}
            title={CONFIG.label}
            titleDescription={CONFIG.description}
            renderGroupAction={renderGroupAction}
          />
        </NoProjectMessage>
      </PageFiltersContainer>
    </IssueListContainer>
  );
}
