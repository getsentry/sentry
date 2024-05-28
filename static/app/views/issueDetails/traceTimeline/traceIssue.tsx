import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getGroupDetailsQueryData} from 'sentry/views/issueDetails/utils';

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
          avatarSize={parseInt(space(4), 10)}
          hideName
          disableLink
        />
      )}
      <IssueDetails>
        {isLoadingGroupData ? (
          <LoadingIndicator mini />
        ) : (
          groupData && (
            <Fragment>
              <NoOverflowDiv>
                <TraceIssueEventTitle>
                  {groupData.metadata.title || groupData.metadata.type}
                </TraceIssueEventTitle>
                <TraceIssueEventTransaction>
                  {event.transaction}
                </TraceIssueEventTransaction>
              </NoOverflowDiv>
              <NoOverflowDiv>{groupData.metadata.value}</NoOverflowDiv>
            </Fragment>
          )
        )}
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

const TraceIssueEventTransaction = styled('span')`
  color: ${p => p.theme.subText};
`;

const NoOverflowDiv = styled('div')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
