import styled from '@emotion/styled';
import {IconChat} from '@sentry/icons/chat';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import type {Group, GroupActivity} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {ActivityFeed} from 'sentry/views/issueDetails/activitySection/activityFeed';
import {
  ActivityFeedItem,
  getActivityFeedItemKey,
} from 'sentry/views/issueDetails/activitySection/activityFeedItem';
import {
  buildActivityFeedItems,
  type DisplayedActivityFeedItem,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';
import {ActivityNoteInput} from 'sentry/views/issueDetails/activitySection/activityNoteInput';
import {useActivityComments} from 'sentry/views/issueDetails/activitySection/useActivityComments';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface ActivitySectionProps {
  group: Group;
  /**
   * Activity to render instead of the activity embedded in the group response.
   */
  activities?: GroupActivity[];
  /**
   * Whether to filter the activity to only show comments.
   */
  filterComments?: boolean;
  minHeight?: number;
  onActivityChange?: (activity: GroupActivity[]) => void;
  /**
   * Controls layout and input style.
   * - `sidebar` (default): fold section, compact input, collapses at 5 items
   * - `standalone`: full input, no collapse
   */
  placeholder?: string;
  variant?: 'sidebar' | 'standalone';
}

export function ActivitySection({
  group,
  activities: providedActivities,
  filterComments,
  onActivityChange,
  variant = 'sidebar',
  minHeight = 96,
  placeholder = t('Add a comment\u2026'),
}: ActivitySectionProps) {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  const activities = providedActivities ?? group.activity;
  const {onCreate, onDelete, onUpdate} = useActivityComments({
    group,
    activities,
    onActivityChange,
  });

  const isStandalone = variant === 'standalone';
  const activityLink = {
    pathname: `${baseUrl}${TabPaths[Tab.ACTIVITY]}`,
    query: {
      ...location.query,
      cursor: undefined,
    },
  };
  const commentsLink = {
    pathname: activityLink.pathname,
    query: {
      ...activityLink.query,
      filter: 'comments',
    },
  };

  const displayedActivities = buildActivityFeedItems({
    activities,
    filterComments,
  });
  const inputVariant = isStandalone ? 'full' : 'compact';
  const timestampUnitStyle = isStandalone ? undefined : 'short';

  const renderActivityItem = (item: DisplayedActivityFeedItem) => (
    <ActivityFeedItem
      key={getActivityFeedItemKey(item)}
      item={item}
      group={group}
      inputVariant={inputVariant}
      timestampUnitStyle={timestampUnitStyle}
      onCommentDelete={onDelete}
      onCommentUpdate={onUpdate}
    />
  );

  const noteInput = (
    <ActivityNoteInput
      storageKey="groupinput:latest"
      itemKey={group.id}
      minHeight={minHeight}
      onSubmit={onCreate}
      placeholder={placeholder}
      variant={inputVariant}
    />
  );

  const timeline = (
    <ActivityFeed>{displayedActivities.map(renderActivityItem)}</ActivityFeed>
  );
  const shouldCollapseSidebar = displayedActivities.length >= 5;
  const sidebarVisibleActivities = shouldCollapseSidebar
    ? displayedActivities.slice(0, 3)
    : displayedActivities;
  // Count the events inside status-flapping rollups so the label reflects how much
  // activity is actually hidden, not how many rows it collapses into.
  const hiddenActivityCount = shouldCollapseSidebar
    ? displayedActivities
        .slice(3)
        .reduce(
          (count, item) =>
            count +
            (item.type === 'collapsed_status_activities' ? item.activities.length : 1),
          0
        )
    : 0;
  const sidebarActivityItems = (
    <ActivityFeed>
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
    </ActivityFeed>
  );

  if (isStandalone) {
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
        <Heading as="h3" size="md">
          {t('Activity')}
        </Heading>
      }
      titleTrailingItems={
        group.numComments > 0 ? (
          <LinkButton
            aria-label={tn('View %s comment', 'View %s comments', group.numComments)}
            icon={<IconChat />}
            size="zero"
            variant="transparent"
            to={commentsLink}
            replace
            preventScrollReset
          >
            {tn('%s comment', '%s comments', group.numComments)}
          </LinkButton>
        ) : null
      }
      sectionKey={SectionKey.ACTIVITY}
    >
      <Grid gap="lg">
        {noteInput}
        {sidebarActivityItems}
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
