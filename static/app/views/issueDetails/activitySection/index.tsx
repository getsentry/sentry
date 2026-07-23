import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NoteBody} from 'sentry/components/activity/note/body';
import {Timeline} from 'sentry/components/timeline';
import {TimeSince} from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType, SEER_ACTIVITY_TYPES} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {ActivityLine} from 'sentry/views/issueDetails/activitySection/activityLineItem';
import {
  ActivityLineNote,
  isActivityNote,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';
import {ActivityNoteInput} from 'sentry/views/issueDetails/activitySection/activityNoteInput';
import {CommentActionsDropdown} from 'sentry/views/issueDetails/activitySection/commentActionsDropdown';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/activitySection/groupActivityIcons';
import {getGroupActivityItem} from 'sentry/views/issueDetails/activitySection/groupActivityItem';
import {useMutateActivity} from 'sentry/views/issueDetails/activitySection/useMutateActivity';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/sidebar/sidebar';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface TimelineItemProps {
  group: Group;
  handleDelete: (item: GroupActivity) => Promise<void>;
  inputVariant: 'compact' | 'full';
  item: GroupActivity;
  size: 'sm' | 'md';
  teams: Team[];
  onCommentEdited?: (activity: GroupActivity[]) => void;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

function TimelineItem({
  item,
  handleDelete,
  onCommentEdited,
  group,
  teams,
  size,
  inputVariant,
  timestampUnitStyle,
}: TimelineItemProps) {
  const organization = useOrganization();
  const useActivityLineItems = organization.features.includes('issue-activity-feed-v2');

  if (useActivityLineItems) {
    if (isActivityNote(item)) {
      // Keep note mutations wired from ActivitySection until the v2 note API settles.
      return (
        <ActivityLineNote
          activity={item}
          group={group}
          inputVariant={inputVariant}
          onDelete={() => handleDelete(item)}
          onCommentEdited={onCommentEdited}
          timestampUnitStyle={timestampUnitStyle}
        />
      );
    }

    return (
      <ActivityLine item={item} group={group} timestampUnitStyle={timestampUnitStyle} />
    );
  }

  return (
    <LegacyTimelineItemWithEditing
      item={item}
      handleDelete={handleDelete}
      onCommentEdited={onCommentEdited}
      group={group}
      teams={teams}
      size={size}
      inputVariant={inputVariant}
      timestampUnitStyle={timestampUnitStyle}
    />
  );
}

function LegacyTimelineItemWithEditing(props: TimelineItemProps) {
  const [editing, setEditing] = useState(false);

  return <LegacyTimelineItem {...props} editing={editing} setEditing={setEditing} />;
}

function LegacyTimelineItem({
  item,
  handleDelete,
  onCommentEdited,
  group,
  teams,
  size,
  inputVariant,
  timestampUnitStyle,
  editing,
  setEditing,
}: {
  editing: boolean;
  group: Group;
  handleDelete: (item: GroupActivity) => Promise<void>;
  inputVariant: 'compact' | 'full';
  item: GroupActivity;
  setEditing: (editing: boolean) => void;
  size: 'sm' | 'md';
  teams: Team[];
  onCommentEdited?: (activity: GroupActivity[]) => void;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}) {
  const organization = useOrganization();
  const {title, message} = getGroupActivityItem(
    item,
    organization,
    group.project,
    group.issueCategory,
    teams
  );

  const iconMapping = groupActivityTypeIconMapping[item.type];
  const componentFunction = iconMapping?.componentFunction;
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
        <TitleRow>
          <Tooltip title={title} showOnlyOnOverflow skipWrapper>
            <TitleText>{title}</TitleText>
          </Tooltip>
          {item.type === GroupActivityType.NOTE && !editing ? (
            <CommentActionsDropdown
              onDelete={() => handleDelete(item)}
              onEdit={() => setEditing(true)}
              user={item.user}
            />
          ) : null}
        </TitleRow>
      }
      timestamp={<Timestamp date={item.dateCreated} unitStyle={timestampUnitStyle} />}
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
          group={group}
          onCommentEdited={activity => {
            onCommentEdited?.(activity);
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

interface ActivitySectionProps {
  group: Group;
  /**
   * Whether to filter the activity to only show comments.
   */
  filterComments?: boolean;
  minHeight?: number;
  onCommentCreated?: (activity: GroupActivity[]) => void;
  onCommentDeleted?: (activity: GroupActivity[]) => void;
  onCommentEdited?: (activity: GroupActivity[]) => void;
  /**
   * Controls layout and input style.
   * - `sidebar` (default): fold section, compact input, collapses at 5 items
   * - `standalone`: full input, no collapse
   */
  placeholder?: string;
  size?: 'sm' | 'md';
  variant?: 'sidebar' | 'standalone';
}

function isDuplicatePullRequestActivity(
  activity: GroupActivity,
  adjacentActivity: GroupActivity | undefined
): boolean {
  switch (activity.type) {
    // REFERENCED_IN_COMMIT should be hidden if there is an adjacent PULL_REQUEST_MERGED activity with the same pull request
    case GroupActivityType.REFERENCED_IN_COMMIT: {
      if (adjacentActivity?.type !== GroupActivityType.PULL_REQUEST_MERGED) {
        return false;
      }

      const pullRequest = activity.data.commit?.pullRequest;
      const adjacentPullRequest = adjacentActivity.data.pullRequest;
      if (!pullRequest || !adjacentPullRequest) {
        return false;
      }

      return (
        pullRequest.id === adjacentPullRequest.id &&
        pullRequest.repository.id === adjacentPullRequest.repository.id
      );
    }
    default:
      return false;
  }
}

function removeAdjacentDuplicatePullRequestActivities(
  activities: GroupActivity[]
): GroupActivity[] {
  return activities.filter(
    (activity, index) =>
      !isDuplicatePullRequestActivity(activity, activities[index - 1]) &&
      !isDuplicatePullRequestActivity(activity, activities[index + 1])
  );
}

export function ActivitySection({
  group,
  filterComments,
  onCommentCreated,
  onCommentDeleted,
  onCommentEdited,
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

  const noteProps = {
    minHeight,
    group,
    placeholder,
  };

  const mutators = useMutateActivity({
    organization,
    group,
  });

  const handleDelete = useCallback(
    async (item: GroupActivity): Promise<void> => {
      const filteredActivity = group.activity.filter(a => a.id !== item.id);
      await mutators.handleDelete(item.id, {
        onSuccess: () => {
          trackAnalytics('issue_details.comment_deleted', {organization});
          addSuccessMessage(t('Comment removed'));
          onCommentDeleted?.(filteredActivity);
        },
      });
    },
    [group.activity, mutators, onCommentDeleted, organization]
  );

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
  const useActivityLineItems = organization.features.includes('issue-activity-feed-v2');
  const visibleActivities = showSeerActivities
    ? group.activity.filter(
        item => useActivityLineItems || item.type !== GroupActivityType.SEER_PR_CREATED
      )
    : group.activity.filter(item => !SEER_ACTIVITY_TYPES.has(item.type));

  const filteredActivities = removeAdjacentDuplicatePullRequestActivities(
    visibleActivities
  ).filter(item => !filterComments || item.type === GroupActivityType.NOTE);
  const inputVariant = variant === 'sidebar' ? 'compact' : 'full';
  const timestampUnitStyle = variant === 'sidebar' ? 'short' : undefined;

  const renderActivityItem = (item: GroupActivity) => (
    <TimelineItem
      item={item}
      handleDelete={handleDelete}
      onCommentEdited={onCommentEdited}
      group={group}
      teams={teams}
      key={item.id}
      size={size}
      inputVariant={inputVariant}
      timestampUnitStyle={timestampUnitStyle}
    />
  );
  const renderActivityList = (children: React.ReactNode) =>
    useActivityLineItems ? (
      <ActivityLineList data-test-id="activity-timeline">{children}</ActivityLineList>
    ) : (
      <Timeline.Container data-test-id="activity-timeline">{children}</Timeline.Container>
    );

  const noteInput = (
    <ActivityNoteInput
      key={inputId}
      storageKey="groupinput:latest"
      itemKey={group.id}
      onCommentCreated={activity => {
        onCommentCreated?.(activity);
        setInputId(uniqueId());
      }}
      variant={inputVariant}
      {...noteProps}
    />
  );

  const timeline = renderActivityList(filteredActivities.map(renderActivityItem));
  const hiddenActivityCount =
    filteredActivities.length >= 5 ? filteredActivities.length - 3 : 0;
  const sidebarVisibleActivities =
    hiddenActivityCount > 0 ? filteredActivities.slice(0, 3) : filteredActivities;
  const sidebarActivityItems = (
    <Fragment>
      {sidebarVisibleActivities.map(renderActivityItem)}
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
              num_activities_hidden: hiddenActivityCount,
            }}
          >
            {hiddenActivityCount > 0
              ? t('View %s more', hiddenActivityCount)
              : t('Expand')}
          </LinkButton>
        </Container>
      </MoreActivityRow>
    </Fragment>
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
        {renderActivityList(sidebarActivityItems)}
      </Grid>
    </SidebarFoldSection>
  );
}

const TitleRow = styled('span')`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  min-width: 0;
  max-width: 100%;
`;

const TitleText = styled('span')`
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  > * {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const ActivityTimelineItem = styled(Timeline.Item)`
  align-items: start;
  grid-template-columns: 22px minmax(0, 1fr) auto;

  ${Timeline.TitleRow} {
    min-width: 0;
  }

  ${Timeline.Title} {
    min-width: 0;
    max-width: 100%;
  }
`;

const Timestamp = styled(TimeSince)`
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
`;

const ActivityLineList = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  container-name: activity-list;
  container-type: inline-size;

  &::before {
    content: '';
    position: absolute;
    left: 10.5px;
    top: 11px;
    bottom: 11px;
    width: 0;
    border-left: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  }
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
