import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';

import type {GroupIntegrationIssueResult} from 'sentry/components/group/externalIssuesList/hooks/types';
import {useGroupExternalIssues} from 'sentry/components/group/externalIssuesList/hooks/useGroupExternalIssues';
import {InlineIssueTrackerActions} from 'sentry/components/group/externalIssuesList/issueTrackerActions';
import {LinkedIssueRows} from 'sentry/components/group/externalIssuesList/linkedIssueRows';
import {Placeholder} from 'sentry/components/placeholder';
import {tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

type ExternalIssueAnalyticsView = 'issue_details' | 'feedback_details';

interface ExternalIssueListProps {
  analyticsView: ExternalIssueAnalyticsView;
  event: Event;
  group: Group;
}

interface ExternalIssueListContentProps extends GroupIntegrationIssueResult {
  analyticsView: ExternalIssueAnalyticsView;
  showInlineIssueTrackerActions?: boolean;
}

export function ExternalIssueList({group, event, analyticsView}: ExternalIssueListProps) {
  const externalIssueData = useGroupExternalIssues({
    group,
    event,
  });

  return (
    <ExternalIssueListContent
      analyticsView={analyticsView}
      integrations={externalIssueData.integrations}
      isLoading={externalIssueData.isLoading}
      linkedIssues={externalIssueData.linkedIssues}
      showInlineIssueTrackerActions
    />
  );
}

export function ExternalIssueListContent({
  analyticsView,
  integrations,
  isLoading,
  linkedIssues,
  showInlineIssueTrackerActions,
}: ExternalIssueListContentProps) {
  const organization = useOrganization();

  if (isLoading) {
    return <Placeholder height="34px" />;
  }

  const hasLinkedIssuesOrIntegrations = integrations.length || linkedIssues.length;
  if (!hasLinkedIssuesOrIntegrations) {
    return (
      <Alert variant="muted">
        {tct(
          'Track this issue in [integrationsLink:Jira, GitHub, etc.], or in your own tracker with a [customIntegrationLink:custom integration].',
          {
            integrationsLink: (
              <Link
                to={`/settings/${organization.slug}/integrations/?category=issue%20tracking`}
              />
            ),
            customIntegrationLink: (
              <Link
                to={`/settings/${organization.slug}/developer-settings/new-internal/?referrer=external_issue_empty_state`}
                onClick={() =>
                  trackIntegrationAnalytics(
                    'integrations.external_issue_custom_integration_cta_clicked',
                    {view: analyticsView, organization}
                  )
                }
              />
            ),
          }
        )}
      </Alert>
    );
  }

  const showIssueTrackerActions =
    Boolean(showInlineIssueTrackerActions) && integrations.length > 0;

  return (
    <Fragment>
      {linkedIssues.length > 0 && <LinkedIssueRows linkedIssues={linkedIssues} />}
      {showIssueTrackerActions && (
        <InlineIssueTrackerActions integrations={integrations} />
      )}
    </Fragment>
  );
}
