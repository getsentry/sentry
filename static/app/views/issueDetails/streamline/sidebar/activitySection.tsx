import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NoteBody} from 'sentry/components/activity/note/body';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import {useMutateActivity} from 'sentry/components/feedback/useMutateActivity';
import {Timeline} from 'sentry/components/timeline';
import {TimeSince} from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import {textStyles} from 'sentry/styles/text';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity, GroupActivityNote} from 'sentry/types/group';
import {GroupActivityType, SEER_ACTIVITY_TYPES} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/streamline/sidebar/groupActivityIcons';
import {getGroupActivityItem} from 'sentry/views/issueDetails/streamline/sidebar/groupActivityItem';
import {NoteDropdown} from 'sentry/views/issueDetails/streamline/sidebar/noteDropdown';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar/sidebar';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

function getAuthorName(item: GroupActivity) {
  if (item.sentry_app) {
    return item.sentry_app.name;
  }
  if (item.user) {
    return item.user.name;
  }
  return 'Sentry';
}

function TimelineItem({
  item,
  handleDelete,
  handleUpdate,
  group,
  teams,
  isDrawer,
}: {
  group: Group;
  handleDelete: (item: GroupActivity) => void;
  handleUpdate: (item: GroupActivity, n: NoteType) => void;
  item: GroupActivity;
  teams: Team[];
  isDrawer?: boolean;
}) {
  const organization = useOrganization();
  const [editing, setEditing] = useState(false);
  const authorName = getAuthorName(item);
  const {title, message} = getGroupActivityItem(
    item,
    organization,
    group.project,
    <strong>{authorName}</strong>,
    teams
  );

  const iconMapping = groupActivityTypeIconMapping[item.type];
  const Icon = iconMapping?.componentFunction
    ? iconMapping.componentFunction({
        data: item.data,
        user: item.user,
        sentry_app: item.sentry_app,
      })
    : (iconMapping?.Component ?? null);

  return (
    <ActivityTimelineItem
      title={
        <Flex gap="xs" align="center" justify="start">
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
        <ActivityNoteInput
          itemKey={item.id}
          storageKey={`groupinput:${item.id}`}
          text={item.data.text}
          noteId={item.id}
          onUpdate={n => {
            handleUpdate(item, n);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onEditFinish={() => setEditing(false)}
        />
      ) : typeof message === 'string' ? (
        <NoteWrapper isDrawer={isDrawer}>
          <NoteBody text={message} />
        </NoteWrapper>
      ) : (
        <MessageWrapper isDrawer={isDrawer}>{message}</MessageWrapper>
      )}
    </ActivityTimelineItem>
  );
}

function ActivityNoteInput(props: React.ComponentProps<typeof NoteInputWithStorage>) {
  return (
    <ActivityInputFrame data-test-id="activity-input-frame">
      <NoteInputWithStorage dangerCancel={false} {...props} />
    </ActivityInputFrame>
  );
}

interface StreamlinedActivitySectionProps {
  group: Group;
  /**
   * Whether to filter the activity to only show comments.
   */
  filterComments?: boolean;
  handleCreate?: (n: NoteType, me: User) => void;
  handleDelete?: (item: GroupActivity) => void;
  handleUpdate?: (item: GroupActivity, n: NoteType) => void;
  /**
   * Whether the activity section is being rendered in the activity drawer.
   * Disables collapse feature, and hides headers
   */
  isDrawer?: boolean;
  isInline?: boolean;
  placeholder?: string;
}

export function StreamlinedActivitySection({
  group,
  isDrawer,
  filterComments,
  handleCreate: handleCreateProp,
  handleDelete: handleDeleteProp,
  handleUpdate: handleUpdateProp,
  isInline,
  placeholder = t('Add a comment\u2026'),
}: StreamlinedActivitySectionProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {teams} = useTeamsById();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  const [inputId, setInputId] = useState(() => uniqueId());

  const activeUser = useUser();
  const projectSlugs = group?.project ? [group.project.slug] : [];
  const noteProps = {
    minHeight: 96,
    group,
    projectSlugs,
    placeholder,
  };

  const mutators = useMutateActivity({
    organization,
    group,
  });

  const handleDelete = useCallback(
    (item: GroupActivity) => {
      if (handleDeleteProp) {
        handleDeleteProp(item);
        return;
      }

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
    [handleDeleteProp, group.activity, mutators, group.id, organization]
  );

  const handleUpdate = useCallback(
    (item: GroupActivity, n: NoteType) => {
      if (handleUpdateProp) {
        handleUpdateProp(item, n);
        return;
      }

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
    [handleUpdateProp, group.activity, mutators, group.id, organization]
  );

  const handleCreate = (n: NoteType, me: User) => {
    if (handleCreateProp) {
      handleCreateProp(n, me);
      return;
    }

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
  };

  const activityLink = {
    pathname: `${baseUrl}${TabPaths[Tab.ACTIVITY]}`,
    query: {
      ...location.query,
      cursor: undefined,
    },
  };

  const showSeerActivities = organization.features.includes('seer-activity-timeline');
  const visibleActivities = showSeerActivities
    ? group.activity
    : group.activity.filter(item => !SEER_ACTIVITY_TYPES.has(item.type));

  const filteredActivities = visibleActivities.filter(
    item => !filterComments || item.type === GroupActivityType.NOTE
  );

  const renderActivityItem = (item: GroupActivity) => (
    <TimelineItem
      item={item}
      handleDelete={handleDelete}
      handleUpdate={handleUpdate}
      group={group}
      teams={teams}
      key={item.id}
      isDrawer={isDrawer}
    />
  );

  const noteInput = (
    <ActivityNoteInput
      key={inputId}
      storageKey="groupinput:latest"
      itemKey={group.id}
      onCreate={n => {
        handleCreate(n, activeUser);
        setInputId(uniqueId());
      }}
      {...noteProps}
    />
  );

  const timeline = (
    <Timeline.Container data-test-id="activity-timeline">
      {filteredActivities.map(renderActivityItem)}
    </Timeline.Container>
  );

  if (isDrawer || isInline) {
    return (
      <InlineActivityLayout>
        {noteInput}
        {timeline}
      </InlineActivityLayout>
    );
  }

  return (
    <SidebarFoldSection
      title={
        <SidebarSectionTitle style={{gap: theme.space.sm, margin: 0}}>
          {t('Activity')}
        </SidebarSectionTitle>
      }
      sectionKey={SectionKey.ACTIVITY}
    >
      <SidebarActivityLayout>
        {noteInput}
        <Timeline.Container data-test-id="activity-timeline">
          {filteredActivities.length < 5 ? (
            filteredActivities.map(renderActivityItem)
          ) : (
            <Fragment>
              {filteredActivities.slice(0, 3).map(renderActivityItem)}
              <ActivityTimelineItem
                title={
                  <LinkButton
                    aria-label={t('View all activity')}
                    to={activityLink}
                    size="xs"
                    replace
                    preventScrollReset
                    analyticsEventKey="issue_details.activity_expanded"
                    analyticsEventName="Issue Details: Activity Expanded"
                    analyticsParams={{
                      num_activities_hidden: filteredActivities.length - 3,
                    }}
                  >
                    {t('View %s more', filteredActivities.length - 3)}
                  </LinkButton>
                }
                icon={<RotatedEllipsisIcon direction="up" />}
              />
            </Fragment>
          )}
        </Timeline.Container>
      </SidebarActivityLayout>
    </SidebarFoldSection>
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
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
`;

const RotatedEllipsisIcon = styled(IconEllipsis)`
  transform: rotate(90deg) translateY(1px);
`;

const NoteWrapper = styled('div')<{isDrawer?: boolean}>`
  ${textStyles}
  font-size: ${p => (p.isDrawer ? p.theme.font.size.md : p.theme.font.size.sm)};
`;

const MessageWrapper = styled('div')<{isDrawer?: boolean}>`
  font-size: ${p => (p.isDrawer ? p.theme.font.size.md : p.theme.font.size.sm)};
`;

const InlineActivityLayout = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
`;

const SidebarActivityLayout = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.lg};
`;

const ActivityInputFrame = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
`;
