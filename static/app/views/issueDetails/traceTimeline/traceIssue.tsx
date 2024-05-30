import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

import type {TimelineEvent} from './useTraceTimelineEvents';

interface TraceIssueEventProps {
  event: TimelineEvent;
}

export function TraceIssueEvent({event}: TraceIssueEventProps) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug: event['project.name']});
  const issueId = event['issue.id'];
  const {title, subtitle} = getTitleSubtitle(event);
  const avatarSize = parseInt(space(4), 10);

  const referrer = 'issue_details.related_trace_issue';

  // If any of data fails to load, we don't want to render the component
  // Only "One other issue appears in the same trace. View Full Trace (X issues)" would show up
  return (
    <Fragment>
      <TraceIssueLinkContainer
        to={{
          pathname: `/organizations/${organization.slug}/issues/${issueId}/events/${event.id}/`,
          query: {
            referrer: referrer,
          },
        }}
        onClick={() => {
          trackAnalytics(`${referrer}.trace_issue_clicked`, {
            organization,
            group_id: issueId,
          });
        }}
      >
        <TraceIssueProjectBadge>
          {project ? (
            <ProjectBadge
              project={project}
              avatarSize={avatarSize}
              hideName
              disableLink
            />
          ) : (
            <Placeholder
              shape="rect"
              width={`${projectBadgeSize}px`}
              height={`${projectBadgeSize}px`}
            />
          )}
        </TraceIssueProjectBadge>
        <TraceIssueDetailsContainer>
          <NoOverflowDiv>
            <TraceIssueEventTitle>{title}</TraceIssueEventTitle>
            <TraceIssueEventTransaction>{event.transaction}</TraceIssueEventTransaction>
          </NoOverflowDiv>
          <NoOverflowDiv>{subtitle}</NoOverflowDiv>
        </TraceIssueDetailsContainer>
      </TraceIssueLinkContainer>
    </Fragment>
  );
}

function getTitleSubtitle(event: TimelineEvent) {
  let title;
  let subtitle;
  if (event['event.type'] === 'error') {
    title = event.title.split(':')[0];
    subtitle = event.message;
  } else {
    title = event.title;
    subtitle = event.message.replace(event.transaction, '').replace(title, '');
  }
  return {title, subtitle};
}

const TraceIssueLinkContainer = styled(Link)`
  display: flex;
  gap: ${space(2)};
  color: ${p => p.theme.textColor};
  padding: ${space(2)} ${space(2)} ${space(2)} ${space(2)};
  margin: ${space(1)} 0 ${space(1)} 0;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};

  &:hover {
    background-color: ${p => p.theme.surface200};
    color: ${p => p.theme.textColor};
  }
`;

// This size helps line up the contents of Suspect Commit
// with the project avatar
const projectBadgeSize = 36;

const TraceIssueProjectBadge = styled('div')`
  height: ${projectBadgeSize}px;
  width: ${projectBadgeSize}px;
  min-width: ${projectBadgeSize}px;
  display: flex;
  align-self: center;
  justify-content: center;
`;

const TraceIssueDetailsContainer = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const NoOverflowDiv = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const TraceIssueEventTitle = styled('span')`
  font-weight: 600;
  margin-right: ${space(1)};
`;

const TraceIssueEventTransaction = styled('span')`
  color: ${p => p.theme.subText};
`;
