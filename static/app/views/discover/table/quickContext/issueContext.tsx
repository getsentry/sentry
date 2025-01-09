import {useEffect} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Count from 'sentry/components/count';
import {getAssignedToDisplayName} from 'sentry/components/group/assignedTo';
import {IconWrapper} from 'sentry/components/sidebarSection';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconMute, IconNot, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

function IssueContext(props: BaseContextProps) {
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
