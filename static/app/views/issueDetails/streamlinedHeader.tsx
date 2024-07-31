import {useMemo} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import Divider from 'sentry/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/divider';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import * as Layout from 'sentry/components/layouts/thirds';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {
  Event,
  Group,
  Project,
  Release,
  TeamParticipant,
  UserParticipant,
} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import GroupActions from 'sentry/views/issueDetails/actions/index';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderTabs} from 'sentry/views/issueDetails/header';
import {useIssueDetailsHeader} from 'sentry/views/issueDetails/useIssueDetailsHeader';
import type {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}

interface GroupHeaderProps {
  baseUrl: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  project: Project;
  event?: Event;
}

export default function StreamlinedGroupHeader({
  group,
  project,
  baseUrl,
  groupReprocessingStatus,
  event,
}: GroupHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {sort: _sort, ...query} = location.query;

  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/first-last-release/`],
    {
      staleTime: 30000,
      cacheTime: 30000,
    }
  );

  const {firstRelease, lastRelease} = groupReleaseData || {};

  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    organization,
    group,
  });

  const {disabledTabs, message, eventRoute, disableActions, shortIdBreadcrumb} =
    useIssueDetailsHeader({
      group,
      groupReprocessingStatus,
      baseUrl,
      project,
    });

  const activeUser = ConfigStore.get('user');

  const {userParticipants, teamParticipants, displayUsers} = useMemo(() => {
    return {
      userParticipants: group.participants.filter(
        (p): p is UserParticipant => p.type === 'user'
      ),
      teamParticipants: group.participants.filter(
        (p): p is TeamParticipant => p.type === 'team'
      ),
      displayUsers: group.seenBy.filter(user => activeUser.id !== user.id),
    };
  }, [group, activeUser.id]);

  return (
    <Layout.Header>
      <div>
        <Breadcrumbs
          crumbs={[
            {
              label: 'Issues',
              to: {
                pathname: `/organizations/${organization.slug}/issues/`,
                query: query,
              },
            },
            {label: shortIdBreadcrumb},
          ]}
        />
        <TitleHeading>
          <TitleWrapper>
            <StyledEventOrGroupTitle data={group} />
          </TitleWrapper>
        </TitleHeading>
        <MessageWrapper>
          <EventMessage
            message={message}
            type={group.type}
            level={group.level}
            showUnhandled={group.isUnhandled}
          />
          <Divider />
          <div>{t('First Seen in')}</div>
          <Version version={firstRelease?.version || ''} projectId={project.id} />
          <Divider />
          <div>{t('Last Seen in')}</div>
          <Version version={lastRelease?.version || ''} projectId={project.id} />
        </MessageWrapper>
        <StyledBreak />
        <InfoWrapper isResolved={group.status === 'resolved'}>
          <GroupActions
            group={group}
            project={project}
            disabled={disableActions}
            event={event}
            query={location.query}
          />
          <PriorityWorkflowWrapper>
            <Wrapper>
              {t('Priority')}
              <GroupPriority group={group} />
            </Wrapper>
            <Wrapper>
              {t('Assignee')}
              <AssigneeSelector
                group={group}
                assigneeLoading={assigneeLoading}
                handleAssigneeChange={handleAssigneeChange}
              />
            </Wrapper>
            {group.participants.length > 0 && (
              <Wrapper>
                {t('Participants')}
                <div>
                  <StyledAvatarList
                    users={userParticipants}
                    teams={teamParticipants}
                    avatarSize={18}
                    maxVisibleAvatars={2}
                    typeAvatars="participants"
                  />
                </div>
              </Wrapper>
            )}
            {displayUsers.length > 0 && (
              <Wrapper>
                {t('Viewers')}
                <StyledAvatarList
                  users={displayUsers}
                  avatarSize={18}
                  maxVisibleAvatars={2}
                />
              </Wrapper>
            )}
          </PriorityWorkflowWrapper>
        </InfoWrapper>
        <GroupHeaderTabs {...{baseUrl, disabledTabs, eventRoute, group, project}} />
      </div>
    </Layout.Header>
  );
}

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: inherit;
`;

const TitleWrapper = styled('h3')`
  font-size: ${p => p.theme.headerFontSize};
  margin: 0 0 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  color: ${p => p.theme.headingColor};

  & em {
    font-weight: ${p => p.theme.fontWeightNormal};
    color: ${p => p.theme.textColor};
    font-size: 90%;
  }
`;

const TitleHeading = styled('div')`
  display: flex;
  line-height: 2;
  gap: ${space(1)};
`;

const StyledBreak = styled('hr')`
  margin-top: ${space(3)};
  margin-bottom: 0;
  border-color: ${p => p.theme.border};
`;

const MessageWrapper = styled('div')`
  display: flex;
  color: ${p => p.theme.gray300};
  gap: ${space(1)};
`;

const InfoWrapper = styled('div')<{isResolved: boolean}>`
  padding: ${space(1)} 0;
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  background-color: ${p =>
    p.isResolved
      ? 'linear-gradient(to right, rgba(235, 250, 246, 0.2) , rgb(235, 250, 246))0'
      : p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
`;

const PriorityWorkflowWrapper = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledAvatarList = styled(AvatarList)`
  justify-content: flex-end;
  padding-left: ${space(0.75)};
`;
