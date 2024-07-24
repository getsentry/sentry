import {useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {assignToActor, clearAssignment} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import AssigneeSelectorDropdown, {
  type AssignableEntity,
} from 'sentry/components/assigneeSelectorDropdown';
import AvatarList from 'sentry/components/avatar/avatarList';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import Divider from 'sentry/components/events/interfaces/debugMeta/debugImageDetails/candidate/information/divider';
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
import {IssueCategory} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {getMessage} from 'sentry/utils/events';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';

import GroupActions from './actions/updatedAction';
import {GroupHeaderTabs} from './header';
import {ShortIdBreadcrumb} from './shortIdBreadcrumb';
import {Tab} from './types';
import {ReprocessingStatus} from './utils';

type GroupRelease = {
  firstRelease: Release;
  lastRelease: Release;
};

interface GroupHeaderProps {
  baseUrl: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  project: Project;
  event?: Event;
}

export default function UpdatedGroupHeader({
  group,
  project,
  baseUrl,
  groupReprocessingStatus,
  event,
}: GroupHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();

  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [
      defined(group)
        ? `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`
        : '',
    ],
    {
      staleTime: 30000,
      cacheTime: 30000,
    }
  );

  const firstRelease = groupReleaseData?.firstRelease;
  const lastRelease = groupReleaseData?.lastRelease;

  const {mutate: handleAssigneeChange, isLoading: assigneeLoading} = useMutation<
    AssignableEntity | null,
    RequestError,
    AssignableEntity | null
  >({
    mutationFn: async (
      newAssignee: AssignableEntity | null
    ): Promise<AssignableEntity | null> => {
      if (newAssignee) {
        await assignToActor({
          id: group!.id,
          orgSlug: organization.slug,
          actor: {id: newAssignee.id, type: newAssignee.type},
          assignedBy: 'assignee_selector',
        });
        return Promise.resolve(newAssignee);
      }

      await clearAssignment(group!.id, organization.slug, 'assignee_selector');
      return Promise.resolve(null);
    },
    onSuccess: (newAssignee: AssignableEntity | null) => {
      if (newAssignee) {
        return;
      }
    },
    onError: () => {
      addErrorMessage('Failed to update assignee');
    },
  });

  const disabledTabs = useMemo(() => {
    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSING) {
      return [
        Tab.ACTIVITY,
        Tab.USER_FEEDBACK,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
      ];
    }

    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT) {
      return [
        Tab.DETAILS,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
        Tab.USER_FEEDBACK,
      ];
    }

    return [];
  }, [groupReprocessingStatus]);

  const eventRoute = useMemo(() => {
    const searchTermWithoutQuery = omit(location.query, 'query');
    return {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };
  }, [location, baseUrl]);

  const disableActions = !!disabledTabs.length;

  let className = 'group-detail';

  if (group.hasSeen) {
    className += ' hasSeen';
  }

  if (group.status === 'resolved') {
    className += ' isResolved';
  }
  const message = getMessage(group);

  const shortIdBreadcrumb = (
    <ShortIdBreadcrumb organization={organization} project={project} group={group} />
  );

  const {participants} = group;

  const userParticipants = participants.filter(
    (p): p is UserParticipant => p.type === 'user'
  );
  const teamParticipants = participants.filter(
    (p): p is TeamParticipant => p.type === 'team'
  );

  const {seenBy} = group;
  const activeUser = ConfigStore.get('user');
  const displayUsers = seenBy.filter(user => activeUser.id !== user.id);

  return (
    <Layout.Header>
      <div className={className}>
        <div>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Issues',
                to: {
                  pathname: `/organizations/${organization.slug}/issues/`,
                  // Sanitize sort queries from query
                  query: omit(location.query, 'sort'),
                },
              },
              {label: shortIdBreadcrumb},
            ]}
          />
        </div>
        <div>
          <TitleWrapper>
            <TitleHeading>
              {group.issueCategory === IssueCategory.REPLAY && (
                <StyledFeatureBadge type="new" />
              )}
              <h3>
                <StyledEventOrGroupTitle data={group} />
              </h3>
            </TitleHeading>
            <MessageWrapper>
              <EventMessage
                message={message}
                level={group.level}
                levelIndicatorSize="11px"
                type={group.type}
                showUnhandled={group.isUnhandled}
                hideLevel
              />
              <Divider />
              <div>{t('First Seen in')}</div>
              <Version version={firstRelease?.version || ''} projectId={project.id} />
              <Divider />
              <div>{t('Last Seen in')}</div>
              <Version version={lastRelease?.version || ''} projectId={project.id} />
            </MessageWrapper>
          </TitleWrapper>
        </div>
        <StyledBreak />
        <InfoWrapper isResolved={group.status === 'resolved'}>
          <GroupActions
            group={group}
            project={project}
            disabled={disableActions}
            event={event}
            query={location.query}
          />
          <PriorityAssignee>
            <Wrapper>
              {t('Priority')}
              <GroupPriority group={group} />
            </Wrapper>
            <Wrapper>
              {t('Assignee')}
              <AssigneeSelectorDropdown
                group={group}
                loading={assigneeLoading}
                onAssign={(assignedActor: AssignableEntity | null) =>
                  handleAssigneeChange(assignedActor)
                }
                onClear={() => handleAssigneeChange(null)}
                trigger={(props, isOpen) => (
                  <StyledDropdownButton
                    {...props}
                    borderless
                    aria-label={t('Modify issue assignee')}
                    size="zero"
                  >
                    <AssigneeBadge
                      assignedTo={group.assignedTo ?? undefined}
                      assignmentReason={
                        group.owners?.find(owner => {
                          const [_ownershipType, ownerId] = owner.owner.split(':');
                          return ownerId === group.assignedTo?.id;
                        })?.type
                      }
                      loading={assigneeLoading}
                      chevronDirection={isOpen ? 'up' : 'down'}
                    />
                  </StyledDropdownButton>
                )}
              />
            </Wrapper>
            {participants.length > 0 && (
              <Wrapper>
                {t('Participants')}
                <div>
                  <StyledAvatarList
                    users={userParticipants}
                    teams={teamParticipants}
                    avatarSize={16}
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
                  avatarSize={16}
                  maxVisibleAvatars={2}
                />
              </Wrapper>
            )}
          </PriorityAssignee>
        </InfoWrapper>
        <GroupHeaderTabs {...{baseUrl, disabledTabs, eventRoute, group, project}} />
      </div>
    </Layout.Header>
  );
}

const TitleWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 65%;
  }
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: inherit;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  align-items: flex-start;
`;

const TitleHeading = styled('div')`
  display: flex;
  line-height: 2;
  gap: ${space(1)};
`;

const StyledBreak = styled('hr')`
  margin-top: ${space(3)};
  margin-bottom: 0;
`;

const MessageWrapper = styled('div')`
  display: flex;
  color: ${p => p.theme.gray300};
  gap: ${space(1)};
`;

const InfoWrapper = styled('div')<{isResolved: boolean}>`
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
  display: flex;
  justify-content: space-between;
  background-color: ${p =>
    p.isResolved ? p.theme.green100 : p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
`;

const PriorityAssignee = styled('div')`
  display: flex;
  gap: ${space(3)};
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledDropdownButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeightNormal};
  border: none;
  padding: 0;
  height: unset;
  border-radius: 10px;
  box-shadow: none;
`;
const StyledAvatarList = styled(AvatarList)`
  justify-content: flex-end;
  padding-left: ${space(0.75)};
`;
