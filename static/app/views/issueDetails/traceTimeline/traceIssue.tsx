import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {getGroupDetailsQueryData} from 'sentry/views/issueDetails/utils';

import type {TimelineEvent} from './useTraceTimelineEvents';

interface TraceIssueEventProps {
  event: TimelineEvent;
}

export function TraceIssueEvent({event}: TraceIssueEventProps) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug: event['project.name']});
  const issueId = event['issue.id'];
  // We are view issue X and loading data for issue Y. This means that this call will not be cached,
  // thus, it is a little bit slow to render the component.
  // XXX: Create new endpoint that only fetches the metadata for the group
  const {data: groupData, isLoading: isLoadingGroupData} = useApiQuery<Group>(
    [
      `/organizations/${organization.slug}/issues/${issueId}/`,
      {query: getGroupDetailsQueryData({})},
    ],
    {
      staleTime: 30000,
      cacheTime: 30000,
      retry: false,
    }
  );
  const avatarSize = parseInt(space(4), 10);

  // If any of data fails to load, we don't want to render the component
  // Only "One other issue appears in the same trace. View Full Trace (X issues)" would show up
  return (
    <Fragment>
      {isLoadingGroupData ? (
        <LoadingIndicator mini />
      ) : (
        groupData && (
          // XXX: Determine plan for analytics
          <TraceIssueLinkContainer
            to={{
              pathname: `/organizations/${organization.slug}/issues/${issueId}/events/${event.id}/`,
              query: {
                referrer: 'issues_trace_issue',
              },
            }}
          >
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
                width={`${avatarSize}px`}
                height={`${avatarSize}px`}
              />
            )}
            <TraceIssueDetailsContainer>
              <NoOverflowDiv>
                <TraceIssueEventTitle>
                  {groupData.metadata.title || groupData.metadata.type}
                </TraceIssueEventTitle>
                <TraceIssueEventTransaction>
                  {event.transaction}
                </TraceIssueEventTransaction>
              </NoOverflowDiv>
              <NoOverflowDiv>{groupData.metadata.value}</NoOverflowDiv>
            </TraceIssueDetailsContainer>
          </TraceIssueLinkContainer>
        )
      )}
    </Fragment>
  );
}

const TraceIssueLinkContainer = styled(Link)`
  display: flex;
  gap: ${space(2)};
  color: ${p => p.theme.textColor};
  padding: ${space(1)} ${space(2)} ${space(1)} ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};

  &:hover {
    background-color: ${p => p.theme.surface200};
    color: ${p => p.theme.textColor};
  }
`;

// The padding-right prevents overflowing the container
// This can be changed with more CSS expertise
const TraceIssueDetailsContainer = styled('div')`
  padding-right: ${space(4)};
`;

const NoOverflowDiv = styled('div')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TraceIssueEventTitle = styled('span')`
  font-weight: 600;
  margin-right: ${space(1)};
`;

const TraceIssueEventTransaction = styled('span')`
  color: ${p => p.theme.subText};
`;
