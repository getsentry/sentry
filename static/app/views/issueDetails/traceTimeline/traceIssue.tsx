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
  const {title, subtitle, message} = getTitleSubtitleMessage(event);
  const avatarSize = parseInt(space(4), 10);

  const referrer = 'issue_details.related_trace_issue';

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
            <TraceIssueEventSubtitle>{subtitle}</TraceIssueEventSubtitle>
          </NoOverflowDiv>
          <NoOverflowDiv>{message}</NoOverflowDiv>
        </TraceIssueDetailsContainer>
      </TraceIssueLinkContainer>
    </Fragment>
  );
}

// This function tries to imitate getTitle() from utils.events
// In that module, the data comes from the issues endpoint while here
// we grab the data from the events endpoint. This is why a larger
// needed in order to use that function directly. We would need
// to grab the metadata for the issue from the issues endpoint.
// At this moment, the issues endpoint is extremely slow and we
// would need
function getTitleSubtitleMessage(event: TimelineEvent) {
  // culprit is what getTitle() from utils.events uses for the subtitle
  const subtitle = event.culprit || '';
  let title = event.title;
  let message = event.message;
  if (event['event.type'] === 'error') {
    // getTitle() from utils.events can either use `metadata.title` (custom title; normally empty) or
    // `metadata.type`. We can't support a customTitle via the events endpoint.
    // Reversed logic from backend:
    // https://github.com/getsentry/sentry/blob/8be60023c8c56b1889a6cc692d857ead7e5b89e2/src/sentry/eventtypes/error.py#L86-L90
    // An event stores the title as "error.type: truncated error.value"
    // We could query error.type and error.value but those are arrays in the events endpoint.
    title = event.title.split(':')[0];
  } else {
    // XXX: Super hacky; find link to source code
    message = event.message.replace(event.transaction, '').replace(title, '');
  }
  return {title, subtitle, message};
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
    background-color: ${p => p.theme.backgroundTertiary};
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

const TraceIssueEventSubtitle = styled('span')`
  color: ${p => p.theme.subText};
`;
