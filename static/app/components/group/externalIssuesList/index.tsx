import {Fragment} from 'react';

import {AlertLink} from '@sentry/scraps/alert';

import type {GroupIntegrationIssueResult} from 'sentry/components/group/externalIssuesList/hooks/types';
import {useGroupExternalIssues} from 'sentry/components/group/externalIssuesList/hooks/useGroupExternalIssues';
import {InlineIssueTrackerActions} from 'sentry/components/group/externalIssuesList/issueTrackerActions';
import {LinkedIssueRows} from 'sentry/components/group/externalIssuesList/linkedIssueRows';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ExternalIssueListProps {
  event: Event;
  group: Group;
}

interface ExternalIssueListContentProps extends GroupIntegrationIssueResult {
  showInlineIssueTrackerActions?: boolean;
}

export function ExternalIssueList({group, event}: ExternalIssueListProps) {
  const externalIssueData = useGroupExternalIssues({
    group,
    event,
  });

  return (
    <ExternalIssueListContent
      integrations={externalIssueData.integrations}
      isLoading={externalIssueData.isLoading}
      linkedIssues={externalIssueData.linkedIssues}
      showInlineIssueTrackerActions
    />
  );
}

export function ExternalIssueListContent({
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
      <AlertLink
        variant="muted"
        to={`/settings/${organization.slug}/integrations/?category=issue%20tracking`}
      >
        {t('Track this issue in Jira, GitHub, etc.')}
      </AlertLink>
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
