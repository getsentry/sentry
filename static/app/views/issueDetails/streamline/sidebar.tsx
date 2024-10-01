import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron, IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import GroupActions from 'sentry/views/issueDetails/actions/index';
import {NewIssueExperienceButton} from 'sentry/views/issueDetails/actions/newIssueExperienceButton';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/activitySection';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useIssueDetailsHeader} from 'sentry/views/issueDetails/useIssueDetailsHeader';
import type {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

type Props = {
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  isSidebarOpen: boolean;
  onToggleSidebar: (e: React.MouseEvent) => void;
  project: Project;
  event?: Event;
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
      <Sidebar isSidebarOpen={false}>
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
    <Sidebar isSidebarOpen>
      <CollapseButton
        icon={<IconChevron direction="right" />}
        title={t('Collapse Sidebar')}
        aria-label={t('Collapse Sidebar')}
        size="sm"
        borderless
        onClick={onToggleSidebar}
      />
      <NewIssueExperienceButton />
      <WorkflowSection
        sectionKey={SectionKey.ISSUE_WORKFLOW}
        title={'Workflow'}
        preventCollapse
      >
        <WorkflowActions
          group={group}
          project={project}
          disabled={disableActions}
          event={event}
          query={location.query}
          isPrototype
        />
        <WorkflowList>
          <WorkflowItem>
            {t('Priority')}
            <GroupPriority group={group} />
          </WorkflowItem>
          <WorkflowItem>
            {t('Assignee')}
            <AssigneeSelector
              group={group}
              assigneeLoading={assigneeLoading}
              handleAssigneeChange={handleAssigneeChange}
            />
          </WorkflowItem>
          {group.participants.length > 0 && (
            <WorkflowItem>
              {t('Participants')}
              <ParticipantList users={userParticipants} teams={teamParticipants} />
            </WorkflowItem>
          )}
          {displayUsers.length > 0 && (
            <WorkflowItem>
              {t('Viewers')}
              <ParticipantList users={displayUsers} />
            </WorkflowItem>
          )}
        </WorkflowList>
      </WorkflowSection>
      {event && (
        <FoldSection
          sectionKey={SectionKey.ISSUE_TRACKING}
          title={t('External Tracking')}
        >
          <StreamlinedExternalIssueList group={group} event={event} project={project} />
        </FoldSection>
      )}
      <FoldSection sectionKey={SectionKey.ISSUE_ACTIVITY} title={t('Activity')}>
        <StreamlinedActivitySection group={group} />
      </FoldSection>
    </Sidebar>
  );
}

const Sidebar = styled('div')<{isSidebarOpen?: boolean}>`
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.background};
  height: 100%;
  border-left: 1px solid ${p => p.theme.translucentBorder};
  max-width: 325px;
  padding: ${p => (p.isSidebarOpen ? space(1.5) : 0)};
`;

const WorkflowSection = styled(FoldSection)`
  margin-top: ${space(3)};
`;

const WorkflowList = styled('div')`
  margin-top: ${space(1)};
`;
const WorkflowItem = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  line-height: 1;
  font-weight: ${p => p.theme.fontWeightBold};
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  padding: ${space(0.5)} ${space(1.5)};
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

const CollapseButton = styled(Button)`
  border-radius: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  background: ${p => p.theme.background};
  color: ${p => p.theme.subText};
  margin: -${space(1.5)} -${space(1.5)} ${space(1.5)};
  border-width: 0;
  border-bottom: 1px solid ${p => p.theme.translucentBorder} !important;
`;

const WorkflowActions = styled(GroupActions)`
  justify-content: space-between;
`;
