import {Fragment, useCallback, useState} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {SentryAppAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
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
import {CommentActionsDropdown} from 'sentry/views/issueDetails/activitySection/commentActionsDropdown';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/activitySection/groupActivityIcons';
import {getGroupActivityItem} from 'sentry/views/issueDetails/activitySection/groupActivityItem';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/sidebar/sidebar';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

function getAuthorName(item: GroupActivity) {
  if (item.sentry_app) {
    return item.sentry_app.name;
  }
  if (item.user) {
    return item.user.name;
  }
  if (
    item.type === GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST &&
    item.data.pullRequest?.author?.name &&
    !item.data.pullRequest.author.email?.endsWith('@localhost')
  ) {
    return item.data.pullRequest.author.name;
  }
  return 'Sentry';
}

function getActivityMarker(item: GroupActivity, color: string) {
  if (item.sentry_app) {
    return (
      <AvatarMarker color={color}>
        <SentryAppAvatar
          data-test-id="sentry-app-activity-marker"
          sentryApp={item.sentry_app}
          size={22}
        />
      </AvatarMarker>
    );
  }
  if (item.user) {
    return (
      <AvatarMarker color={color}>
        <UserAvatar data-test-id="user-activity-marker" user={item.user} size={22} />
      </AvatarMarker>
    );
  }
  return <SentryMarker color={color} data-test-id="sentry-activity-marker" />;
}

function getActivityColorConfig(theme: Theme, type: GroupActivityType) {
  const defaultConfig = {
    title: theme.tokens.content.primary,
    icon: theme.tokens.content.secondary,
    iconBorder: theme.tokens.content.secondary,
  };

  switch (type) {
    case GroupActivityType.SET_RESOLVED:
    case GroupActivityType.SET_RESOLVED_BY_AGE:
    case GroupActivityType.SET_RESOLVED_IN_RELEASE:
    case GroupActivityType.SET_RESOLVED_IN_COMMIT:
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST:
    case GroupActivityType.MARK_REVIEWED:
    case GroupActivityType.SEER_RCA_COMPLETED:
    case GroupActivityType.SEER_SOLUTION_COMPLETED:
    case GroupActivityType.SEER_CODING_COMPLETED:
    case GroupActivityType.SEER_PR_CREATED:
      return {
        ...defaultConfig,
        icon: theme.tokens.graphics.success.vibrant,
        iconBorder: theme.tokens.border.success.vibrant,
      };
    case GroupActivityType.SET_UNRESOLVED:
    case GroupActivityType.SET_REGRESSION:
      return {
        ...defaultConfig,
        icon: theme.tokens.graphics.danger.vibrant,
        iconBorder: theme.tokens.border.danger.vibrant,
      };
    case GroupActivityType.SET_ESCALATING:
    case GroupActivityType.SET_PRIORITY:
      return {
        ...defaultConfig,
        icon: theme.tokens.graphics.warning.vibrant,
        iconBorder: theme.tokens.border.warning.vibrant,
      };
    case GroupActivityType.SET_IGNORED:
      return {
        ...defaultConfig,
      };
    default:
      return defaultConfig;
  }
}

function TimelineItem({
  item,
  handleDelete,
  handleUpdate,
  group,
  teams,
  size,
  inputVariant,
  timestampUnitStyle,
}: {
  group: Group;
  handleDelete: (item: GroupActivity) => void;
  handleUpdate: (item: GroupActivity, n: NoteType) => void;
  inputVariant: 'compact' | 'full';
  item: GroupActivity;
  size: 'sm' | 'md';
  teams: Team[];
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}) {
  const organization = useOrganization();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const useTwoColumnLayout = organization.features.includes('issue-activity-feed-v2');
  const authorName = getAuthorName(item);
  const colorConfig = getActivityColorConfig(theme, item.type);
  const {title, message} = getGroupActivityItem(
    item,
    organization,
    group.project,
    group.issueCategory,
    <strong>{authorName}</strong>,
    teams
  );

  const iconMapping = groupActivityTypeIconMapping[item.type];
  const componentFunction =
    useTwoColumnLayout && item.type === GroupActivityType.NOTE
      ? undefined
      : iconMapping?.componentFunction;
  const Icon = componentFunction
    ? componentFunction({
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
            <CommentActionsDropdown
              onDelete={() => handleDelete(item)}
              onEdit={() => setEditing(true)}
              user={item.user}
            />
          )}
        </Flex>
      }
      timestamp={<Timestamp date={item.dateCreated} unitStyle={timestampUnitStyle} />}
      marker={useTwoColumnLayout ? getActivityMarker(item, colorConfig.icon) : undefined}
      colorConfig={useTwoColumnLayout ? colorConfig : undefined}
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
          minHeight={96}
          variant={inputVariant}
          text={item.data.text}
          noteId={item.id}
          onUpdate={n => {
            handleUpdate(item, n);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : typeof message === 'string' ? (
        <NoteBody text={message} />
      ) : (
        <Text as="div" size={size}>
          {message}
        </Text>
      )}
    </ActivityTimelineItem>
  );
}

function ActivityNoteInput(props: React.ComponentProps<typeof NoteInputWithStorage>) {
  return (
    <ActivityInputFrame data-test-id="activity-input-frame">
      <NoteInputWithStorage {...props} />
    </ActivityInputFrame>
  );
}

interface ActivitySectionProps {
  group: Group;
  /**
   * Whether to filter the activity to only show comments.
   */
  filterComments?: boolean;
  minHeight?: number;
  onCreate?: (n: NoteType, me: User) => void;
  onDelete?: (item: GroupActivity) => void;
  onUpdate?: (item: GroupActivity, n: NoteType) => void;
  /**
   * Controls layout and input style.
   * - `sidebar` (default): fold section, compact input, collapses at 5 items
   * - `standalone`: full input, no collapse
   */
  placeholder?: string;
  size?: 'sm' | 'md';
  variant?: 'sidebar' | 'standalone';
}

export function ActivitySection({
  group,
  filterComments,
  onCreate: onCreateProp,
  onDelete: onDeleteProp,
  onUpdate: onUpdateProp,
  variant = 'sidebar',
  size = 'sm',
  minHeight = 96,
  placeholder = t('Add a comment\u2026'),
}: ActivitySectionProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {teams} = useTeamsById();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  const [inputId, setInputId] = useState(() => uniqueId());

  const activeUser = useUser();
  const projectSlugs = group?.project ? [group.project.slug] : [];
  const noteProps = {
    minHeight,
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
      if (onDeleteProp) {
        onDeleteProp(item);
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
    [onDeleteProp, group.activity, mutators, group.id, organization]
  );

  const handleUpdate = useCallback(
    (item: GroupActivity, n: NoteType) => {
      if (onUpdateProp) {
        onUpdateProp(item, n);
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
    [onUpdateProp, group.activity, mutators, group.id, organization]
  );

  const handleCreate = (n: NoteType, me: User) => {
    if (onCreateProp) {
      onCreateProp(n, me);
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

  const showSeerActivities = organization.features.includes(
    'display-seer-actions-as-issue-activities'
  );
  const visibleActivities = showSeerActivities
    ? group.activity.filter(item => item.type !== GroupActivityType.SEER_PR_CREATED)
    : group.activity.filter(item => !SEER_ACTIVITY_TYPES.has(item.type));

  const filteredActivities = visibleActivities.filter(
    item => !filterComments || item.type === GroupActivityType.NOTE
  );
  const inputVariant = variant === 'sidebar' ? 'compact' : 'full';
  const timestampUnitStyle = variant === 'sidebar' ? 'short' : undefined;

  const renderActivityItem = (item: GroupActivity) => (
    <TimelineItem
      item={item}
      handleDelete={handleDelete}
      handleUpdate={handleUpdate}
      group={group}
      teams={teams}
      key={item.id}
      size={size}
      inputVariant={inputVariant}
      timestampUnitStyle={timestampUnitStyle}
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
      variant={inputVariant}
      {...noteProps}
    />
  );

  const timeline = (
    <Timeline.Container data-test-id="activity-timeline">
      {filteredActivities.map(renderActivityItem)}
    </Timeline.Container>
  );

  if (variant === 'standalone') {
    return (
      <Grid gap="xl">
        {noteInput}
        {timeline}
      </Grid>
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
      <Grid gap="lg">
        {noteInput}
        <Timeline.Container data-test-id="activity-timeline">
          {filteredActivities.length < 5 ? (
            filteredActivities.map(renderActivityItem)
          ) : (
            <Fragment>
              {filteredActivities.slice(0, 3).map(renderActivityItem)}
              <MoreActivityRow>
                <MoreActivityIcon>
                  <RotatedEllipsisIcon direction="up" />
                </MoreActivityIcon>
                <Container marginTop="xs">
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
                </Container>
              </MoreActivityRow>
            </Fragment>
          )}
        </Timeline.Container>
      </Grid>
    </SidebarFoldSection>
  );
}

const TitleTooltip = styled(Tooltip)`
  justify-self: start;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ActivityTimelineItem = styled(Timeline.Item)`
  align-items: center;
`;

const Timestamp = styled(TimeSince)`
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
`;

const RotatedEllipsisIcon = styled(IconEllipsis)`
  position: relative;
  left: 1px;
  transform: rotate(90deg) translate(1px, 1px);
`;

const MoreActivityRow = styled('div')`
  position: relative;
  display: grid;
  align-items: center;
  grid-template-columns: 22px minmax(0, 1fr);
  grid-column-gap: ${p => p.theme.space.md};
  margin: ${p => p.theme.space.md} 0 0;

  &::after {
    content: '';
    position: absolute;
    left: 10.5px;
    top: 50%;
    bottom: 0;
    width: 1px;
    background: ${p => p.theme.tokens.background.primary};
  }
`;

const MoreActivityIcon = styled('div')`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  min-height: 22px;
  color: ${p => p.theme.tokens.content.secondary};
  background: ${p => p.theme.tokens.background.primary};
`;

const ActivityInputFrame = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  min-width: 0;
`;

const AvatarMarker = styled('span')<{color: string}>`
  display: block;
  position: relative;
  border-radius: 100%;
  line-height: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 100%;
    box-shadow: inset 0 0 0 2px ${p => p.color};
    pointer-events: none;
  }
`;

const SentryMarker = styled('span')<{color: string}>`
  width: 12px;
  height: 12px;
  border-radius: 100%;
  background: ${p => p.theme.tokens.background.primary};
  display: grid;
  place-items: center;

  &::after {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 100%;
    background: ${p => p.color};
  }
`;
