import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {TimeSince} from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  GroupActivityType,
  SEER_ACTIVITY_TYPES,
  type Group,
  type GroupActivity,
} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActivityLine} from 'sentry/views/issueDetails/activitySection/activityLineItem';
import {
  collapseSeerActivityPairs,
  type ActivityFeedItem,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';
import {ActivityLineList} from 'sentry/views/issueDetails/activitySection/activityLineItem/layout';
import {
  ActivityLineNote,
  isActivityNote,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';
import {ActivityNoteInput} from 'sentry/views/issueDetails/activitySection/activityNoteInput';
import {useMutateActivity} from 'sentry/views/issueDetails/activitySection/useMutateActivity';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/sidebar/sidebar';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface ActivityFeedRowProps {
  group: Group;
  handleDelete: (item: GroupActivity) => Promise<void>;
  inputVariant: 'compact' | 'full';
  item: ActivityFeedItem;
  onCommentEdited?: (activity: GroupActivity[]) => void;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

function ActivityFeedRow({
  item,
  handleDelete,
  onCommentEdited,
  group,
  inputVariant,
  timestampUnitStyle,
}: ActivityFeedRowProps) {
  const {activity} = item;

  if (!isActivityNote(activity)) {
    return (
      <ActivityLine item={item} group={group} timestampUnitStyle={timestampUnitStyle} />
    );
  }

  return (
    <ActivityLineNote
      activity={activity}
      group={group}
      inputVariant={inputVariant}
      onDelete={() => handleDelete(activity)}
      onCommentEdited={onCommentEdited}
      timestampUnitStyle={timestampUnitStyle}
    />
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
    case GroupActivityType.SEER_PR_CREATED: {
      if (adjacentActivity?.type !== GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST) {
        return false;
      }

      const adjacentPullRequest = adjacentActivity.data.pullRequest;
      if (!adjacentPullRequest) {
        return false;
      }

      return Boolean(
        activity.data.pull_requests?.some(
          pullRequest =>
            pullRequest.pull_request.pr_url === adjacentPullRequest.externalUrl
        )
      );
    }
    default:
      return false;
  }
}

function removeAdjacentDuplicatePullRequestActivities(activities: GroupActivity[]): {
  activities: GroupActivity[];
  actorActivityById: Map<string, GroupActivity>;
} {
  const actorActivityById = new Map<string, GroupActivity>();
  const filteredActivities = activities.filter((activity, index) => {
    const duplicateActivity = [activities[index - 1], activities[index + 1]].find(
      adjacentActivity => isDuplicatePullRequestActivity(activity, adjacentActivity)
    );

    if (activity.type === GroupActivityType.SEER_PR_CREATED && duplicateActivity) {
      actorActivityById.set(duplicateActivity.id, activity);
    }

    return !duplicateActivity;
  });

  return {activities: filteredActivities, actorActivityById};
}

export function ActivitySection({
  group,
  filterComments,
  onCommentCreated,
  onCommentDeleted,
  onCommentEdited,
  variant = 'sidebar',
  minHeight = 96,
  placeholder = t('Add a comment\u2026'),
}: ActivitySectionProps) {
  const theme = useTheme();
  const organization = useOrganization();
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
  const visibleActivities = showSeerActivities
    ? group.activity
    : group.activity.filter(item => !SEER_ACTIVITY_TYPES.has(item.type));

  const {activities: deduplicatedActivities, actorActivityById} =
    removeAdjacentDuplicatePullRequestActivities(visibleActivities);
  const filteredActivities = deduplicatedActivities.filter(
    item => !filterComments || item.type === GroupActivityType.NOTE
  );
  const displayedActivities = collapseSeerActivityPairs(filteredActivities).map(item => {
    const actorActivity = actorActivityById.get(item.activity.id);
    return item.type === 'activity' && actorActivity ? {...item, actorActivity} : item;
  });
  const inputVariant = variant === 'sidebar' ? 'compact' : 'full';
  const timestampUnitStyle = variant === 'sidebar' ? 'short' : undefined;

  const renderActivityItem = (item: ActivityFeedItem) => (
    <ActivityFeedRow
      item={item}
      handleDelete={handleDelete}
      onCommentEdited={onCommentEdited}
      group={group}
      key={item.activity.id}
      inputVariant={inputVariant}
      timestampUnitStyle={timestampUnitStyle}
    />
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

  const timeline = (
    <ActivityLineList data-test-id="activity-timeline">
      {displayedActivities.map(renderActivityItem)}
    </ActivityLineList>
  );
  const hiddenActivityCount =
    displayedActivities.length >= 5 ? displayedActivities.length - 3 : 0;
  const sidebarVisibleActivities =
    hiddenActivityCount > 0 ? displayedActivities.slice(0, 3) : displayedActivities;
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
        <ActivityLineList data-test-id="activity-timeline">
          {sidebarActivityItems}
        </ActivityLineList>
      </Grid>
    </SidebarFoldSection>
  );
}

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
