import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {TimeSince} from 'sentry/components/timeSince';
import {IconChat, IconEllipsis} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group, GroupActivity} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActivityLine} from 'sentry/views/issueDetails/activitySection/activityLineItem';
import {
  buildActivityFeedItems,
  type DisplayedActivityFeedItem,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';
import {CollapsedStatusActivityRow} from 'sentry/views/issueDetails/activitySection/activityLineItem/collapsedStatusActivityRow';
import {ActivityLineList} from 'sentry/views/issueDetails/activitySection/activityLineItem/layout';
import {
  ActivityLineNote,
  isActivityNote,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';
import {ActivityNoteInput} from 'sentry/views/issueDetails/activitySection/activityNoteInput';
import {useMutateActivity} from 'sentry/views/issueDetails/activitySection/useMutateActivity';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface ActivityFeedRowProps {
  group: Group;
  handleDelete: (item: GroupActivity) => Promise<void>;
  inputVariant: 'compact' | 'full';
  item: DisplayedActivityFeedItem;
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
  if (item.type === 'collapsed_status_activities') {
    return (
      <CollapsedStatusActivityRow eventCount={item.activities.length}>
        {item.activities.map(activity => (
          <ActivityFeedRow
            item={activity}
            handleDelete={handleDelete}
            onCommentEdited={onCommentEdited}
            group={group}
            key={activity.activity.id}
            inputVariant={inputVariant}
            timestampUnitStyle={timestampUnitStyle}
          />
        ))}
      </CollapsedStatusActivityRow>
    );
  }

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
   * Activity to render instead of the activity embedded in the group response.
   */
  activities?: GroupActivity[];
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

export function ActivitySection({
  group,
  activities: providedActivities,
  filterComments,
  onCommentCreated,
  onCommentDeleted,
  onCommentEdited,
  variant = 'sidebar',
  minHeight = 96,
  placeholder = t('Add a comment\u2026'),
}: ActivitySectionProps) {
  const organization = useOrganization();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  const [inputId, setInputId] = useState(() => uniqueId());
  const activities = providedActivities ?? group.activity;

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
      const filteredActivity = activities.filter(a => a.id !== item.id);
      await mutators.handleDelete(item.id, {
        onSuccess: () => {
          trackAnalytics('issue_details.comment_deleted', {organization});
          addSuccessMessage(t('Comment removed'));
          onCommentDeleted?.(filteredActivity);
        },
      });
    },
    [activities, mutators, onCommentDeleted, organization]
  );

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
    showSeerActivities: organization.features.includes(
      'display-seer-actions-as-issue-activities'
    ),
    showStatusFlappingRollups: organization.features.includes(
      'issue-activity-status-flapping-rollup'
    ),
  });
  const inputVariant = isStandalone ? 'full' : 'compact';
  const timestampUnitStyle = isStandalone ? undefined : 'short';

  const renderActivityItem = (item: DisplayedActivityFeedItem) => (
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
