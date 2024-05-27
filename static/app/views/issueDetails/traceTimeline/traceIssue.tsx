import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import type {TimelineEvent} from './useTraceTimelineEvents';

interface TraceIssueEventProps {
  event: TimelineEvent;
}

export function TraceIssueEvent({event}: TraceIssueEventProps) {
  const organization = useOrganization();
  const {projects} = useProjects({
    slugs: [event.project],
    orgId: organization.slug,
  });
  const project = projects.find(p => p.slug === event.project);
  const issueId = event['issue.id'];
  return (
    <TraceIssueEventRoot
      to={{
        pathname: `/organizations/${organization.slug}/issues/${issueId}/events/${event.id}/`,
        query: {
          referrer: 'issues_trace_issue',
        },
      }}
      onClick={() => {
        trackAnalytics('issue_details.issue_tab.trace_issue_clicked', {
          organization,
          event_id: event.id,
          group_id: issueId,
        });
      }}
    >
      {project && (
        <ProjectBadge
          project={project}
          avatarSize={parseInt(space(2), 10)}
          hideName
          disableLink
        />
      )}
      <IssueDetails>
        <NoOverflowDiv>
          <TraceIssueEventTitle>{event.title.split(':')[0]}</TraceIssueEventTitle>
          {event.transaction}
        </NoOverflowDiv>
        <NoOverflowDiv>{event.message}</NoOverflowDiv>
      </IssueDetails>
    </TraceIssueEventRoot>
  );
}

const TraceIssueEventRoot = styled(Link)`
  display: flex;
  color: ${p => p.theme.textColor};
  padding: ${space(2)} ${space(2)} ${space(2)} ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};

  &:hover {
    background-color: ${p => p.theme.surface200};
    color: ${p => p.theme.textColor};
  }
`;

const IssueDetails = styled('div')`
  max-width: 100%;
  padding: ${space(0)} ${space(1)} ${space(0)} ${space(1)};
`;

const TraceIssueEventTitle = styled('span')`
  font-weight: 600;
`;

const NoOverflowDiv = styled('div')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
