import {Fragment} from 'react';
import styled from '@emotion/styled';

import {AlertLink} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {GroupIntegrationIssueResult} from 'sentry/components/group/externalIssuesList/hooks/types';
import {useGroupExternalIssues} from 'sentry/components/group/externalIssuesList/hooks/useGroupExternalIssues';
import {InlineIssueTrackerActions} from 'sentry/components/group/externalIssuesList/issueTrackerActions';
import {LinkedIssueRows} from 'sentry/components/group/externalIssuesList/linkedIssueRows';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ExternalIssueListProps {
  event: Event;
  group: Group;
  project: Project;
}

export function ExternalIssueList({group, event, project}: ExternalIssueListProps) {
  const externalIssueData = useGroupExternalIssues({
    group,
    event,
    project,
  });

  return (
    <ExternalIssueListContent
      integrations={externalIssueData.integrations}
      isLoading={externalIssueData.isLoading}
      linkedIssues={externalIssueData.linkedIssues}
    />
  );
}

export function ExternalIssueListContent({
  integrations,
  isLoading,
  linkedIssues,
}: GroupIntegrationIssueResult) {
  const organization = useOrganization();
  const hasLinkedPullRequestsFeature = organization.features.includes(
    'issue-details-linked-pull-requests'
  );
  const loadingPlaceholderHeight = hasLinkedPullRequestsFeature ? '34px' : '25px';

  if (isLoading) {
    return <Placeholder height={loadingPlaceholderHeight} />;
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
    !hasLinkedPullRequestsFeature && integrations.length > 0;

  return (
    <Fragment>
      {linkedIssues.length > 0 &&
        (hasLinkedPullRequestsFeature ? (
          <LinkedIssueRows linkedIssues={linkedIssues} />
        ) : (
          <LinkedIssuesList linkedIssues={linkedIssues} />
        ))}
      {showIssueTrackerActions && (
        <InlineIssueTrackerActions integrations={integrations} />
      )}
    </Fragment>
  );
}

function LinkedIssuesList({
  linkedIssues,
}: {
  linkedIssues: GroupIntegrationIssueResult['linkedIssues'];
}) {
  return (
    <IssueActionWrapper>
      {linkedIssues.map(linkedIssue => (
        <ErrorBoundary key={linkedIssue.key} mini>
          <Tooltip
            overlayStyle={{maxWidth: '400px'}}
            position="bottom"
            title={
              <LinkedIssueTooltipWrapper>
                <LinkedIssueName>{linkedIssue.title}</LinkedIssueName>
                <HorizontalSeparator />
                <UnlinkButton variant="link" size="zero" onClick={linkedIssue.onUnlink}>
                  {t('Unlink issue')}
                </UnlinkButton>
              </LinkedIssueTooltipWrapper>
            }
            isHoverable
          >
            <LinkedIssue
              href={linkedIssue.url}
              external
              size="zero"
              icon={linkedIssue.displayIcon}
            >
              <IssueActionName>{linkedIssue.displayName}</IssueActionName>
            </LinkedIssue>
          </Tooltip>
        </ErrorBoundary>
      ))}
    </IssueActionWrapper>
  );
}

const IssueActionWrapper = styled('span')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.md};
  line-height: 1.2;
`;

const LinkedIssue = styled(LinkButton)`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border: none;
  border-radius: ${p => p.theme.radius.md};
  font-weight: normal;
`;

const IssueActionName = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const LinkedIssueTooltipWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  white-space: nowrap;
`;

const LinkedIssueName = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: ${p => p.theme.space['2xs']};
`;

const HorizontalSeparator = styled('div')`
  width: 1px;
  height: 14px;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background: ${p => p.theme.tokens.border.primary};
`;

const UnlinkButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;
