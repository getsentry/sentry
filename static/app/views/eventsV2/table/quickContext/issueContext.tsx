import {useEffect} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Count from 'sentry/components/count';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import EventCause from 'sentry/components/events/eventCause';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import {getAssignedToDisplayName} from 'sentry/components/group/assignedTo';
import {Panel} from 'sentry/components/panels';
import {IconWrapper} from 'sentry/components/sidebarSection';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark, IconMute, IconNot, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Group} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useQuery} from 'sentry/utils/queryClient';

import {NoContext} from './quickContextWrapper';
import {
  ContextBody,
  ContextContainer,
  ContextHeader,
  ContextRow,
  Wrapper,
} from './styles';
import {BaseContextProps, ContextType, fiveMinutesInMs} from './utils';

function IssueContext(props: BaseContextProps) {
  const statusTitle = t('Issue Status');
  const {dataRow, organization} = props;

  useEffect(() => {
    trackAdvancedAnalyticsEvent('discover_v2.quick_context_hover_contexts', {
      organization,
      contextType: ContextType.ISSUE,
    });
  }, [organization]);

  const {
    isLoading: issueLoading,
    isError: issueError,
    data: issue,
  } = useQuery<Group>(
    [
      `/issues/${dataRow['issue.id']}/`,
      {
        query: {
          collapse: 'release',
          expand: 'inbox',
        },
      },
    ],
    {
      staleTime: fiveMinutesInMs,
    }
  );

  // NOTE: Suspect commits are generated from the first event of an issue.
  // Therefore, all events for an issue have the same suspect commits.
  const {
    isLoading: eventLoading,
    isError: eventError,
    data: event,
  } = useQuery<Event>([`/issues/${dataRow['issue.id']}/events/oldest/`], {
    staleTime: fiveMinutesInMs,
  });

  const renderStatusAndCounts = () =>
    issue && (
      <IssueContextContainer data-test-id="quick-context-issue-status-container">
        <ContextRow>
          <div>
            <ContextHeader>{t('Events')}</ContextHeader>
            <ContextBody>
              <Count className="count" value={issue.count} />
            </ContextBody>
          </div>
          <div>
            <ContextHeader>{t('Users')}</ContextHeader>
            <ContextBody>
              <Count className="count" value={issue.userCount} />
            </ContextBody>
          </div>
          <div>
            <ContextHeader>{statusTitle}</ContextHeader>
            <ContextBody>
              {issue.status === 'ignored' ? (
                <IconMute
                  data-test-id="quick-context-ignored-icon"
                  color="gray500"
                  size="xs"
                />
              ) : issue.status === 'resolved' ? (
                <IconCheckmark color="gray500" size="xs" />
              ) : (
                <IconNot
                  data-test-id="quick-context-unresolved-icon"
                  color="gray500"
                  size="xs"
                />
              )}
              <StatusText>{issue.status}</StatusText>
            </ContextBody>
          </div>
        </ContextRow>
      </IssueContextContainer>
    );

  const renderAssignee = () =>
    issue && (
      <AssignedToContainer data-test-id="quick-context-assigned-to-container">
        <ContextHeader>{t('Assigned To')}</ContextHeader>
        <AssignedToBody>
          {issue.assignedTo ? (
            <ActorAvatar
              data-test-id="assigned-avatar"
              actor={issue.assignedTo}
              hasTooltip={false}
              size={24}
            />
          ) : (
            <IconWrapper>
              <IconUser size="md" />
            </IconWrapper>
          )}
          {getAssignedToDisplayName(issue, issue.assignedTo)}
        </AssignedToBody>
      </AssignedToContainer>
    );

  const renderSuspectCommits = () =>
    event &&
    event.eventID &&
    issue && (
      <IssueContextContainer data-test-id="quick-context-suspect-commits-container">
        <EventCause
          project={issue.project}
          eventId={event.eventID}
          commitRow={QuickContextCommitRow}
        />
      </IssueContextContainer>
    );

  const isLoading = issueLoading || eventLoading;
  const isError = issueError || eventError;
  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  return (
    <Wrapper data-test-id="quick-context-hover-body">
      {renderStatusAndCounts()}
      {renderAssignee()}
      {renderSuspectCommits()}
    </Wrapper>
  );
}

const IssueContextContainer = styled(ContextContainer)`
  ${SidebarSection.Wrap}, ${Panel}, h6 {
    margin: 0;
  }

  ${Panel} {
    border: none;
    box-shadow: none;
  }

  ${DataSection} {
    padding: 0;
  }

  ${CauseHeader} {
    margin-top: ${space(2)};
  }

  ${CauseHeader} > h3,
  ${CauseHeader} > button {
    font-size: ${p => p.theme.fontSizeExtraSmall};
    font-weight: 600;
    text-transform: uppercase;
  }
`;

const AssignedToContainer = styled(IssueContextContainer)`
  margin-top: ${space(2)};
`;

const StatusText = styled('span')`
  margin-left: ${space(0.5)};
  text-transform: capitalize;
`;

const AssignedToBody = styled(ContextBody)`
  gap: ${space(1)};
`;

export default IssueContext;
