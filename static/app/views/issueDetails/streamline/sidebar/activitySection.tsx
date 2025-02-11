import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NoteBody} from 'sentry/components/activity/note/body';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import Link from 'sentry/components/links/link';
import Timeline from 'sentry/components/timeline';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChat, IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity, GroupActivityNote} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/streamline/sidebar/groupActivityIcons';
import getGroupActivityItem from 'sentry/views/issueDetails/streamline/sidebar/groupActivityItem';
import {NoteDropdown} from 'sentry/views/issueDetails/streamline/sidebar/noteDropdown';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar/sidebar';
import {ViewButton} from 'sentry/views/issueDetails/streamline/sidebar/viewButton';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

function TimelineItem({
  item,
  handleDelete,
  handleUpdate,
  group,
  teams,
}: {
  group: Group;
  handleDelete: (item: GroupActivity) => void;
  handleUpdate: (item: GroupActivity, n: NoteType) => void;
  item: GroupActivity;
  teams: Team[];
}) {
  const organization = useOrganization();
  const [editing, setEditing] = useState(false);
  const [_, setHoveredActivity] = useSyncedLocalStorageState<string | null>(
    `streamlined-activity-section-hovered-activity`,
    null
  );
  const authorName = item.user ? item.user.name : 'Sentry';
  const {title, message} = getGroupActivityItem(
    item,
    organization,
    group.project,
    <strong>{authorName}</strong>,
    teams
  );

  const iconMapping = groupActivityTypeIconMapping[item.type];
  const Icon = iconMapping?.componentFunction
    ? iconMapping.componentFunction(item.data, item.user)
    : iconMapping?.Component ?? null;

  return (
    <ActivityTimelineItem
      onMouseEnter={() => setHoveredActivity(item.dateCreated)}
      onMouseLeave={() => setHoveredActivity(null)}
      title={
        <Flex gap={space(0.5)} align="center" justify="flex-start">
          <TitleTooltip title={title} showOnlyOnOverflow>
            {title}
          </TitleTooltip>
          {item.type === GroupActivityType.NOTE && !editing && (
            <TitleDropdown
              onDelete={() => handleDelete(item)}
              onEdit={() => setEditing(true)}
              user={item.user}
            />
          )}
        </Flex>
      }
      timestamp={<Timestamp date={item.dateCreated} tooltipProps={{skipWrapper: true}} />}
      icon={
        Icon && (
          <Icon
            {...iconMapping.defaultProps}
            {...iconMapping.propsFunction?.(item.data)}
            size="xs"
          />
        )
      }
    >
      {item.type === GroupActivityType.NOTE && editing ? (
        <NoteInputWithStorage
          itemKey={item.id}
          storageKey={`groupinput:${item.id}`}
          source="issue-details"
          text={item.data.text}
          noteId={item.id}
          onUpdate={n => {
            handleUpdate(item, n);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : typeof message === 'string' ? (
        <NoteWrapper>
          <NoteBody text={message} />
        </NoteWrapper>
      ) : (
        message
      )}
    </ActivityTimelineItem>
  );
}

interface StreamlinedActivitySectionProps {
  group: Group;
  /**
   * Whether the activity section is being rendered in the activity drawer.
   * Disables collapse feature, and hides headers
   */
  isDrawer?: boolean;
}

export default function StreamlinedActivitySection({
  group,
  isDrawer,
}: StreamlinedActivitySectionProps) {
  const organization = useOrganization();
  const {teams} = useTeamsById();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  const [inputId, setInputId] = useState(() => uniqueId());

  const activeUser = useUser();
  const projectSlugs = group?.project ? [group.project.slug] : [];
  const noteProps = {
    minHeight: 140,
    group,
    projectSlugs,
    placeholder: t('Add a comment\u2026'),
  };

  const mutators = useMutateActivity({
    organization,
    group,
  });

  const handleDelete = useCallback(
    (item: GroupActivity) => {
      const restore = group.activity.find(activity => activity.id === item.id);
      const index = GroupStore.removeActivity(group.id, item.id);

      if (index === -1 || restore === undefined) {
        addErrorMessage(t('Failed to delete comment'));
        return;
      }
      mutators.handleDelete(
        item.id,
        group.activity.filter(a => a.id !== item.id),
        {
          onError: () => {
            addErrorMessage(t('Failed to delete comment'));
          },
          onSuccess: () => {
            trackAnalytics('issue_details.comment_deleted', {
              organization,
              streamline: true,
              org_streamline_only: organization.streamlineOnly ?? undefined,
            });
            addSuccessMessage(t('Comment removed'));
          },
        }
      );
    },
    [group.activity, mutators, group.id, organization]
  );

  const handleUpdate = useCallback(
    (item: GroupActivity, n: NoteType) => {
      mutators.handleUpdate(n, item.id, group.activity, {
        onError: () => {
          addErrorMessage(t('Unable to update comment'));
        },
        onSuccess: data => {
          const d = data as GroupActivityNote;
          GroupStore.updateActivity(group.id, data.id, {text: d.data.text});
          addSuccessMessage(t('Comment updated'));
          trackAnalytics('issue_details.comment_updated', {
            organization,
            streamline: true,
            org_streamline_only: organization.streamlineOnly ?? undefined,
          });
        },
      });
    },
    [group.activity, mutators, group.id, organization]
  );

  const handleCreate = useCallback(
    (n: NoteType, _me: User) => {
      mutators.handleCreate(n, group.activity, {
        onError: err => {
          const errMessage = err.responseJSON?.detail
            ? tct('Error: [msg]', {msg: err.responseJSON?.detail as string})
            : t('Unable to post comment');
          addErrorMessage(errMessage);
        },
        onSuccess: data => {
          GroupStore.addActivity(group.id, data);
          trackAnalytics('issue_details.comment_created', {
            organization,
            streamline: true,
            org_streamline_only: organization.streamlineOnly ?? undefined,
          });
          addSuccessMessage(t('Comment posted'));
        },
      });
    },
    [group.activity, mutators, group.id, organization]
  );

  const activityLink = {
    pathname: `${baseUrl}${TabPaths[Tab.ACTIVITY]}`,
    query: {
      ...location.query,
      cursor: undefined,
    },
  };

  return (
    <div>
      {!isDrawer && (
        <Flex justify="space-between" align="center">
          <SidebarSectionTitle style={{gap: space(0.75)}}>
            {t('Activity')}
            {group.numComments > 0 ? (
              <CommentsLink
                to={activityLink}
                aria-label={t('Number of comments: %s', group.numComments)}
              >
                <IconChat
                  size="xs"
                  color={
                    group.subscriptionDetails?.reason === 'mentioned'
                      ? 'successText'
                      : undefined
                  }
                />
                <span>{group.numComments}</span>
              </CommentsLink>
            ) : null}
          </SidebarSectionTitle>
          <ViewButton
            aria-label={t('Open activity drawer')}
            to={{
              pathname: `${baseUrl}${TabPaths[Tab.ACTIVITY]}`,
              query: {
                ...location.query,
                cursor: undefined,
              },
            }}
            analyticsEventKey="issue_details.activity_drawer_opened"
            analyticsEventName="Issue Details: Activity Drawer Opened"
            analyticsParams={{
              num_activities: group.activity.length,
            }}
          >
            {t('View')}
          </ViewButton>
        </Flex>
      )}
      <Timeline.Container>
        <NoteInputWithStorage
          key={inputId}
          storageKey="groupinput:latest"
          itemKey={group.id}
          onCreate={n => {
            handleCreate(n, activeUser);
            setInputId(uniqueId());
          }}
          source="issue-details"
          {...noteProps}
        />
        {(group.activity.length < 5 || isDrawer) &&
          group.activity.map(item => {
            return (
              <TimelineItem
                item={item}
                handleDelete={handleDelete}
                handleUpdate={handleUpdate}
                group={group}
                teams={teams}
                key={item.id}
              />
            );
          })}
        {!isDrawer && group.activity.length >= 5 && (
          <Fragment>
            {group.activity.slice(0, 3).map(item => {
              return (
                <TimelineItem
                  item={item}
                  handleDelete={handleDelete}
                  handleUpdate={handleUpdate}
                  group={group}
                  teams={teams}
                  key={item.id}
                />
              );
            })}
            <ActivityTimelineItem
              title={
                <LinkButton
                  aria-label={t('View all activity')}
                  to={activityLink}
                  size="xs"
                  analyticsEventKey="issue_details.activity_expanded"
                  analyticsEventName="Issue Details: Activity Expanded"
                  analyticsParams={{
                    num_activities_hidden: group.activity.length - 3,
                  }}
                >
                  {t('View %s more', group.activity.length - 3)}
                </LinkButton>
              }
              icon={<RotatedEllipsisIcon direction={'up'} />}
            />
          </Fragment>
        )}
      </Timeline.Container>
    </div>
  );
}

const TitleTooltip = styled(Tooltip)`
  justify-self: start;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TitleDropdown = styled(NoteDropdown)`
  font-weight: normal;
`;

const ActivityTimelineItem = styled(Timeline.Item)`
  align-items: center;
  grid-template-columns: 22px minmax(50px, 1fr) auto;
`;

const Timestamp = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
`;

const RotatedEllipsisIcon = styled(IconEllipsis)`
  transform: rotate(90deg) translateY(1px);
`;

const NoteWrapper = styled('div')`
  ${textStyles}
`;

const CommentsLink = styled(Link)`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  color: ${p => p.theme.subText};
`;
