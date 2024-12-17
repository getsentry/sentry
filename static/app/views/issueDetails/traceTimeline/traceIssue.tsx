import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
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
  const area = useAnalyticsArea();

  // Referrer used to be hard-coded for this component. It's used for analytics
  // only. We'll still use the old referrer for backwards compatibility.
  const queryReferrer = area.includes('issue_details')
    ? 'issue_details.related_trace_issue'
    : area;

  return (
    <Fragment>
      <TraceIssueLinkContainer
        to={{
          pathname: `/organizations/${organization.slug}/issues/${issueId}/events/${event.id}/`,
          query: {
            referrer: queryReferrer,
          },
        }}
        onClick={() => {
          // Track this event for backwards compatibility. TODO: remove after issues team dashboards/queries are migrated
          if (area.includes('issue_details')) {
            trackAnalytics('issue_details.related_trace_issue.trace_issue_clicked', {
              organization,
              group_id: issueId,
            });
          }
          trackAnalytics('one_other_related_trace_issue.clicked', {
            organization,
            group_id: issueId,
            area,
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
            <TraceIssueEventSubtitle data-test-id="subtitle-span">
              {subtitle}
            </TraceIssueEventSubtitle>
          </NoOverflowDiv>
          <NoOverflowDiv>{message}</NoOverflowDiv>
        </TraceIssueDetailsContainer>
      </TraceIssueLinkContainer>
    </Fragment>
  );
}

// This function tries to imitate what getTitle() from utils.events does.
// In that module, the data comes from the issues endpoint while in here
// we grab the data from the events endpoint. A larger effort is
// required in order to use that function directly since the data between
// the two endpoint is slightly different.
// For instance, the events endpoint could include a _metadata dict with
// the title, subtitle and message.
// We could also make another call to the issues endpoint  to fetch the metadata,
// however, we currently don't support it and it is extremely slow
export function getTitleSubtitleMessage(event: TimelineEvent) {
  let title = event.title.trimEnd();
  let subtitle = event.culprit;
  let message = '';
  try {
    if (event['event.type'] === 'error') {
      if (title[title.length - 1] !== ':') {
        title = event.title.split(':')[0];
      }
      // It uses metadata.value which could differ depending on what error.value is used in the event manager
      // TODO: Add support for chained exceptions since we grab the value from the first stack trace
      // https://github.com/getsentry/sentry/blob/a221f399d2b4190f2631fcca311bdb5b3748838b/src/sentry/eventtypes/error.py#L115-L134
      message = event['error.value'].at(-1) ?? '';
    } else if (event['event.type'] === 'default') {
      // See getTitle() and getMessage() in sentry/utils/events.tsx
      subtitle = '';
      message = event.culprit;
    } else {
      // It is suspected that this value is calculated somewhere in Relay
      // and we deconstruct it here to match what the Issue details page shows
      message = event.message.replace(event.culprit, '').replace(title, '').trimStart();
    }
  } catch (error) {
    // If we fail, report it so we can figure it out
    Sentry.captureException(error);
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
