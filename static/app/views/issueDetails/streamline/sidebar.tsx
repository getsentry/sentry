import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/activitySection';
import GroupActions from 'sentry/views/issueDetails/actions/index';
import {useIssueDetailsHeader} from 'sentry/views/issueDetails/useIssueDetailsHeader';
import {useLocation} from 'sentry/utils/useLocation';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import {useMemo, useState} from 'react';
import ConfigStore from 'sentry/stores/configStore';
import {t} from 'sentry/locale';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {Button} from 'sentry/components/button';
import {IconClose, IconPanel} from 'sentry/icons';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';

type Props = {
  group: Group;
  project: Project;
  event?: Event;
  groupReprocessingStatus: ReprocessingStatus;
  onToggleSidebar: (e: React.MouseEvent) => void;
  isSidebarOpen: boolean;
};

export default function StreamlinedSidebar({
  group,
  event,
  project,
  groupReprocessingStatus,
  isSidebarOpen,
  onToggleSidebar,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const baseUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${group.id}/${
      event ? `events/${event.id}/` : ''
    }`
  );

  const {disableActions} = useIssueDetailsHeader({
    group,
    project,
    baseUrl,
    groupReprocessingStatus,
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

  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    organization,
    group,
  });

  if (!isSidebarOpen) {
    return (
      <Sidebar>
        <SidebarToggle
          aria-label={t('Close Sidebar')}
          title={t('Open Sidebar')}
          onClick={onToggleSidebar}
        >
          <SidebarIcon size="sm" direction="right" />
          <InteractionStateLayer />
        </SidebarToggle>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <Button
        icon={<IconClose direction="right" />}
        title={t('Open Sidebar')}
        aria-label={t('Open Sidebar')}
        size="sm"
        borderless
        onClick={onToggleSidebar}
      />
      <FoldSection
        sectionKey={SectionKey.ISSUE_WORKFLOW}
        title={'Workflow'}
        preventCollapse
      >
        <GroupActions
          group={group}
          project={project}
          disabled={disableActions}
          event={event}
          query={location.query}
        />
        <WorkflowActions>
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
              <ParticipantList users={userParticipants} teams={teamParticipants} />
            </Wrapper>
          )}
          {displayUsers.length > 0 && (
            <Wrapper>
              {t('Viewers')}
              <ParticipantList users={displayUsers} />
            </Wrapper>
          )}
        </WorkflowActions>
      </FoldSection>
      {event && (
        <FoldSection
          sectionKey={SectionKey.ISSUE_TRACKING}
          title={t('External Tracking')}
          preventCollapse
        >
          <StreamlinedExternalIssueList group={group} event={event} project={project} />
        </FoldSection>
      )}
      <FoldSection
        sectionKey={SectionKey.ISSUE_ACTIVITY}
        title={t('Activity')}
        preventCollapse
      >
        <StreamlinedActivitySection group={group} />
      </FoldSection>
    </Sidebar>
  );
}

const Sidebar = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  background-color: ${p => p.theme.background};
  height: 100%;
  border-left: 1px solid ${p => p.theme.translucentBorder};
`;

const WorkflowActions = styled('div')``;

const Wrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
  &:nth-child(even) {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

export const SidebarTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
`;

const SidebarToggle = styled('div')`
  border: 0;
  outline: 0;
  min-width: 40px;
  background-color: ${p => p.theme.background};
  border-radius: 0;
  height: 100%;
  position: relative;
  display: block;
`;

const SidebarIcon = styled(IconPanel)`
  position: sticky;
  top: 35px;
  display: block;
  margin: 50px auto;
  color: ${p => p.theme.subText};
`;
