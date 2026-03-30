import {useEffect} from 'react';
import styled from '@emotion/styled';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {IconWrapper} from 'sentry/components/sidebarSection';
import {IconCheckmark, IconMute, IconNot, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {MemberListStore} from 'sentry/stores/memberListStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import {makeFetchGroupQueryKey} from 'sentry/views/issueDetails/useGroup';

import {NoContext} from './quickContextWrapper';
import {
  ContextBody,
  ContextContainer,
  ContextHeader,
  ContextRow,
  ContextTitle,
  Wrapper,
} from './styles';
import type {BaseContextProps} from './utils';
import {ContextType} from './utils';

export function IssueContext(props: BaseContextProps) {
  const {dataRow, organization} = props;

  useEffect(() => {
    trackAnalytics('discover_v2.quick_context_hover_contexts', {
      organization,
      contextType: ContextType.ISSUE,
    });
  }, [organization]);

  const {
    isPending: issueLoading,
    isError: issueError,
    data: issue,
  } = useApiQuery<Group>(
    makeFetchGroupQueryKey({
      groupId: dataRow['issue.id'],
      organizationSlug: organization.slug,
      // The link to issue details doesn't seem to currently pass selected environments
      environments: [],
    }),
    {
      staleTime: 30_000,
    }
  );

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
                  variant="muted"
                  size="xs"
                />
              ) : issue.status === 'resolved' ? (
                <IconCheckmark variant="primary" size="xs" />
              ) : (
                <IconNot
                  data-test-id="quick-context-unresolved-icon"
                  variant="primary"
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

  if (issueLoading || issueError) {
    return <NoContext isLoading={issueLoading} />;
  }

  return (
    <Wrapper data-test-id="quick-context-hover-body">
      {renderTitle()}
      {renderStatusAndCounts()}
      {renderAssignee()}
    </Wrapper>
  );
}

function getAssignedToDisplayName(group: Group) {
  if (group.assignedTo?.type === 'team') {
    const team = TeamStore.getById(group.assignedTo.id);
    return `#${team?.slug ?? group.assignedTo.name}`;
  }
  if (group.assignedTo?.type === 'user') {
    const user = MemberListStore.getById(group.assignedTo.id);
    return user?.name ?? group.assignedTo.name;
  }

  return group.assignedTo?.name;
}

const IssueTitleBody = styled(ContextBody)`
  margin: 0;
  max-width: 300px;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const IssueContextContainer = styled(ContextContainer)`
  & + & {
    margin-top: ${p => p.theme.space.xl};
  }
`;

const StatusText = styled('span')`
  margin-left: ${p => p.theme.space.xs};
  text-transform: capitalize;
`;

const AssignedToBody = styled(ContextBody)`
  gap: ${p => p.theme.space.md};
`;

const StyledIconWrapper = styled(IconWrapper)`
  margin: 0;
`;
