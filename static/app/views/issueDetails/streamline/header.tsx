import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import Count from 'sentry/components/count';
import ErrorLevel from 'sentry/components/events/errorLevel';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {useUser} from 'sentry/utils/useUser';
import GroupActions from 'sentry/views/issueDetails/actions/index';
import {Divider} from 'sentry/views/issueDetails/divider';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import {ShortIdBreadcrumb} from 'sentry/views/issueDetails/shortIdBreadcrumb';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/streamline/assigneeSelector';
import {AttachmentsBadge} from 'sentry/views/issueDetails/streamline/attachmentsBadge';
import {ReplayBadge} from 'sentry/views/issueDetails/streamline/replayBadge';
import {UserFeedbackBadge} from 'sentry/views/issueDetails/streamline/userFeedbackBadge';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

interface GroupHeaderProps {
  event: Event | null;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  project: Project;
}

export default function StreamlinedGroupHeader({
  event,
  group,
  groupReprocessingStatus,
  project,
}: GroupHeaderProps) {
  const activeUser = useUser();
  const location = useLocation();
  const organization = useOrganization();
  const {baseUrl} = useGroupDetailsRoute();
  const {sort: _sort, ...query} = location.query;
  const {count: eventCount, userCount} = group;
  const {title: primaryTitle, subtitle: secondaryTitle} = getTitle(group);
  const message = getMessage(group);
  const isComplete = group.status === 'resolved' || group.status === 'ignored';
  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(groupReprocessingStatus);
  const [sidebarOpen, setSidebarOpen] = useSyncedLocalStorageState(
    'issue-details-sidebar-open',
    true
  );

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
    <Fragment>
      <Header>
        <Breadcrumbs
          crumbs={[
            {
              label: 'Issues',
              to: {
                pathname: `/organizations/${organization.slug}/issues/`,
                query,
              },
            },
            {
              label: (
                <ShortIdBreadcrumb
                  organization={organization}
                  project={project}
                  group={group}
                />
              ),
            },
          ]}
        />
        <HeaderGrid>
          <Flex gap={space(0.75)} align="flex-end">
            <PrimaryTitle title={primaryTitle} isHoverable showOnlyOnOverflow>
              {primaryTitle}
            </PrimaryTitle>
            <SecondaryTitle title={secondaryTitle} isHoverable showOnlyOnOverflow>
              {secondaryTitle}
            </SecondaryTitle>
          </Flex>
          <StatTitle to={`${baseUrl}events/${location.search}`}>{t('Events')}</StatTitle>
          <StatTitle to={`${baseUrl}tags/user/${location.search}`}>
            {t('Users')}
          </StatTitle>
          <Flex gap={space(1)} align="center" justify="flex-start">
            <ErrorLevel level={group.level} size={'10px'} />
            {group.isUnhandled && <UnhandledTag />}
            <Divider />
            <Message
              title={message}
              disabled={!message}
              hasMessage={!!message}
              isHoverable
              showOnlyOnOverflow
            >
              {message ?? t('No error message')}
            </Message>
            <AttachmentsBadge group={group} />
            <UserFeedbackBadge group={group} project={project} />
            <ReplayBadge group={group} project={project} />
          </Flex>
          <StatCount value={eventCount} />
          <StatCount value={userCount} />
        </HeaderGrid>
      </Header>
      <ActionBar isComplete={isComplete}>
        <GroupActions
          group={group}
          project={project}
          disabled={disableActions}
          event={event}
          query={location.query}
        />
        <Flex justify="flex-end" gap={space(2)}>
          <Workflow>
            {t('Priority')}
            <GroupPriority group={group} />
          </Workflow>
          <Workflow>
            {t('Assignee')}
            <GroupHeaderAssigneeSelector group={group} project={project} event={event} />
          </Workflow>
          {group.participants.length > 0 && (
            <Workflow>
              {t('Participants')}
              <ParticipantList users={userParticipants} teams={teamParticipants} />
            </Workflow>
          )}
          {displayUsers.length > 0 && (
            <Workflow>
              {t('Viewers')}
              <ParticipantList users={displayUsers} />
            </Workflow>
          )}
          <Divider />
          <Button
            icon={
              sidebarOpen ? (
                <IconChevron direction="right" color="gray300" />
              ) : (
                <IconPanel direction="right" color="gray300" />
              )
            }
            title={sidebarOpen ? t('Close Sidebar') : t('Open Sidebar')}
            aria-label={sidebarOpen ? t('Close Sidebar') : t('Open Sidebar')}
            size="sm"
            borderless
            onClick={() => setSidebarOpen(!sidebarOpen)}
          />
        </Flex>
      </ActionBar>
    </Fragment>
  );
}

const Header = styled('div')`
  background-color: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(1)} 24px;
`;

const HeaderGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto auto;
  gap: ${space(0.75)} ${space(2)};
  align-items: center;
`;

const PrimaryTitle = styled(Tooltip)`
  line-height: 1;
  font-size: 20px;
  font-weight: ${p => p.theme.fontWeightBold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SecondaryTitle = styled(PrimaryTitle)`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const StatTitle = styled(Link)`
  display: block;
  text-decoration: underline;
  text-decoration-style: dotted;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1;
  align-self: flex-end;
  justify-self: flex-end;
`;

const StatCount = styled(Count)`
  display: block;
  font-size: 20px;
  line-height: 1;
  text-align: right;
`;

const Message = styled(Tooltip)<{hasMessage: boolean}>`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${p => p.theme.subText};
  font-style: ${p => (p.hasMessage ? 'initial' : 'italic')};
`;

const ActionBar = styled('div')<{isComplete: boolean}>`
  display: flex;
  justify-content: space-between;
  gap: ${space(1.5)};
  flex-wrap: wrap;
  padding: ${space(1)} 24px;
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
  position: relative;
  transition: background 0.3s ease-in-out;
  background: ${p => (p.isComplete ? 'transparent' : p.theme.background)};
  &:before {
    z-index: -1;
    position: absolute;
    inset: 0;
    content: '';
    background: linear-gradient(
      to right,
      ${p => p.theme.background},
      ${p => Color(p.theme.success).lighten(0.5).alpha(0.15).string()}
    );
  }
`;

const Workflow = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
  align-items: center;
`;
