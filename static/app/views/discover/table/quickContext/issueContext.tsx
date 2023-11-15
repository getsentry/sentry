import {useEffect} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Count from 'sentry/components/count';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import {DataSection, SuspectCommitHeader} from 'sentry/components/events/styles';
import {StyledPanel, SuspectCommits} from 'sentry/components/events/suspectCommits';
import {getAssignedToDisplayName} from 'sentry/components/group/assignedTo';
import Panel from 'sentry/components/panels/panel';
import {IconWrapper} from 'sentry/components/sidebarSection';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconMute, IconNot, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';

import {NoContext} from './quickContextWrapper';
import {
  ContextBody,
  ContextContainer,
  ContextHeader,
  ContextRow,
  ContextTitle,
  Wrapper,
} from './styles';
import {BaseContextProps, ContextType, tenSecondInMs} from './utils';

function IssueContext(props: BaseContextProps) {
  const {dataRow, organization} = props;

  useEffect(() => {
    trackAnalytics('discover_v2.quick_context_hover_contexts', {
      organization,
      contextType: ContextType.ISSUE,
    });
  }, [organization]);

  const {
    isLoading: issueLoading,
    isError: issueError,
    data: issue,
  } = useApiQuery<Group>(
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
      staleTime: tenSecondInMs,
    }
  );

  // NOTE: Suspect commits are generated from the first event of an issue.
  // Therefore, all events for an issue have the same suspect commits.
  const {
    isLoading: eventLoading,
    isError: eventError,
    data: event,
  } = useApiQuery<Event>([`/issues/${dataRow['issue.id']}/events/oldest/`], {
    staleTime: tenSecondInMs,
  });

  const title = issue?.title;
  const renderTitle = () =>
    issue && (
      <IssueContextContainer data-test-id="quick-context-issue-title-container">
        <ContextHeader>
          <ContextTitle>{t('Title')}</ContextTitle>
        </ContextHeader>
        <Tooltip showOnlyOnOverflow skipWrapper title={title}>
          <IssueTitleBody>{title}</IssueTitleBody>
        </Tooltip>
      </IssueContextContainer>
    );

  const renderStatusAndCounts = () =>
    issue && (
      <IssueContextContainer data-test-id="quick-context-issue-status-container">
        <ContextRow>
          <div>
            <ContextHeader>
              <ContextTitle>{t('Events')}</ContextTitle>
            </ContextHeader>
            <ContextBody>
              <Count className="count" value={issue.count} />
            </ContextBody>
          </div>
          <div>
            <ContextHeader>
              <ContextTitle>{t('Users')}</ContextTitle>
            </ContextHeader>
            <ContextBody>
              <Count className="count" value={issue.userCount} />
            </ContextBody>
          </div>
          <div>
            <ContextHeader>
              <ContextTitle>{t('Issue Status')}</ContextTitle>
            </ContextHeader>
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
      <IssueContextContainer data-test-id="quick-context-assigned-to-container">
        <ContextHeader>
          <ContextTitle>{t('Assigned To')}</ContextTitle>
        </ContextHeader>
        <AssignedToBody>
          {issue.assignedTo ? (
            <ActorAvatar
              data-test-id="assigned-avatar"
              actor={issue.assignedTo}
              hasTooltip={false}
              size={24}
            />
          ) : (
            <StyledIconWrapper>
              <IconUser size="md" />
            </StyledIconWrapper>
          )}
          {getAssignedToDisplayName(issue) ?? t('No one')}
        </AssignedToBody>
      </IssueContextContainer>
    );

  const renderSuspectCommits = () =>
    event &&
    event.eventID &&
    issue && (
      <SuspectCommitsContainer data-test-id="quick-context-suspect-commits-container">
        <SuspectCommits
          project={issue.project}
          eventId={event.eventID}
          commitRow={QuickContextCommitRow}
        />
      </SuspectCommitsContainer>
    );

  const isLoading = issueLoading || eventLoading;
  const isError = issueError || eventError;
  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  return (
    <Wrapper data-test-id="quick-context-hover-body">
      {renderTitle()}
      {renderStatusAndCounts()}
      {renderAssignee()}
      {renderSuspectCommits()}
    </Wrapper>
  );
}

const SuspectCommitsContainer = styled(ContextContainer)`
  ${SidebarSection.Wrap}, ${Panel}, h6 {
    margin: 0;
  }

  ${StyledPanel} {
    border: none;
    box-shadow: none;
  }

  ${DataSection} {
    padding: 0;
  }

  ${SuspectCommitHeader} {
    margin: ${space(2)} 0 ${space(0.75)};
  }
`;

const IssueTitleBody = styled(ContextBody)`
  margin: 0;
  max-width: 300px;
  ${p => p.theme.overflowEllipsis}
`;

const IssueContextContainer = styled(ContextContainer)`
  & + & {
    margin-top: ${space(2)};
  }
`;

const StatusText = styled('span')`
  margin-left: ${space(0.5)};
  text-transform: capitalize;
`;

const AssignedToBody = styled(ContextBody)`
  gap: ${space(1)};
`;

const StyledIconWrapper = styled(IconWrapper)`
  margin: 0;
`;
export default IssueContext;
