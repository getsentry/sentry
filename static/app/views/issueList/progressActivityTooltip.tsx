import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {NoteBody} from 'sentry/components/activity/note/body';
import {Hovercard} from 'sentry/components/hovercard';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActivityLine} from 'sentry/views/issueDetails/activitySection/activityLineItem';
import {getActivityNoteAuthor} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityItem';
import {
  ActivityLineContent,
  ActivityLineHeadline,
  ActivityLineList,
  ActivityLineRow,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/layout';
import {isActivityNote} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';
import {ActivityLineMarker} from 'sentry/views/issueDetails/activitySection/activityLineItem/progressMarker';

// Only include activity items that describe issue progress changes. Other
// activity types can be useful in the full activity feed, but are noise here.
const PROGRESS_ACTIVITY_TYPES = new Set<GroupActivityType>([
  GroupActivityType.NOTE,
  GroupActivityType.FIRST_SEEN,
  GroupActivityType.SEER_RCA_COMPLETED,
  GroupActivityType.SEER_PR_CREATED,
  GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
  GroupActivityType.PULL_REQUEST_CLOSED,
  GroupActivityType.REFERENCED_IN_COMMIT,
  GroupActivityType.SET_RESOLVED_IN_COMMIT,
  GroupActivityType.SET_RESOLVED_IN_RELEASE,
  GroupActivityType.SET_RESOLVED_BY_AGE,
  GroupActivityType.SET_RESOLVED,
  GroupActivityType.SET_UNRESOLVED,
  GroupActivityType.SET_REGRESSION,
  GroupActivityType.ASSIGNED,
  GroupActivityType.UNASSIGNED,
]);

const MAX_ITEMS = 3;

function getProgressActivities(activities: GroupActivity[]): GroupActivity[] {
  // `activities` is ordered newest-first. Collect the most recent matching
  // items, then reverse so the newest activity is rendered at the bottom.
  // Falls back to the most recent items if no progress-specific ones exist.
  const result: GroupActivity[] = [];
  for (const activity of activities) {
    if (PROGRESS_ACTIVITY_TYPES.has(activity.type)) {
      result.push(activity);
      if (result.length >= MAX_ITEMS) {
        break;
      }
    }
  }
  if (result.length > 0) {
    return result.toReversed();
  }
  return activities.slice(0, MAX_ITEMS).toReversed();
}

function ProgressActivityItem({group, item}: {group: Group; item: GroupActivity}) {
  if (isActivityNote(item)) {
    return <ProgressActivityNote item={item} />;
  }

  return (
    <ActivityLine
      group={group}
      item={{type: 'activity', activity: item}}
      timestampUnitStyle="extraShort"
    />
  );
}

function ProgressActivityNote({
  item,
}: {
  item: Extract<GroupActivity, {type: GroupActivityType.NOTE}>;
}) {
  const organization = useOrganization();
  const showProgress = organization.features.includes('issue-activity-progress');

  return (
    <ActivityLineRow>
      <ActivityLineMarker item={item} showProgress={showProgress} />
      <ActivityLineHeadline
        title={getActivityNoteAuthor(item)}
        timestamp={<TimeSince date={item.dateCreated} unitStyle="extraShort" />}
      />
      <ActivityLineContent>
        <NoteBody text={item.data.text} />
      </ActivityLineContent>
    </ActivityLineRow>
  );
}

function ProgressActivityBody({group}: {group: Group}) {
  const organization = useOrganization();

  const {data, isPending, isError} = useQuery(
    apiOptions.as<{activity: GroupActivity[]}>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/activities/',
      {
        path: {organizationIdOrSlug: organization.slug, issueId: group.id},
        staleTime: 30_000,
      }
    )
  );

  if (isPending) {
    return (
      <ActivityListContainer>
        <Flex align="center" justify="center" minHeight="40px">
          <LoadingIndicator size={24} />
        </Flex>
      </ActivityListContainer>
    );
  }

  if (isError) {
    return (
      <ActivityListContainer>
        <Flex align="center" justify="center" minHeight="40px">
          <Text variant="muted">{t('Failed to load activity.')}</Text>
        </Flex>
      </ActivityListContainer>
    );
  }

  const items = getProgressActivities(data?.activity ?? []);

  if (items.length === 0) {
    return (
      <ActivityListContainer>
        <Flex align="center" justify="center" minHeight="40px">
          <Text variant="muted">{t('No activity.')}</Text>
        </Flex>
      </ActivityListContainer>
    );
  }

  return (
    <ActivityListContainer>
      <ActivityLineList>
        {items.map(item => (
          <ProgressActivityItem key={item.id} group={group} item={item} />
        ))}
      </ActivityLineList>
    </ActivityListContainer>
  );
}

interface ProgressActivityTooltipProps {
  children: React.ReactNode;
  group: Group;
}

export function ProgressActivityTooltip({children, group}: ProgressActivityTooltipProps) {
  return (
    <ClassNames>
      {({css}) => (
        <ProgressHovercard
          body={
            <HovercardBodyBoundary onClick={event => event.stopPropagation()}>
              <ProgressActivityBody group={group} />
            </HovercardBodyBoundary>
          }
          bodyClassName={css`
            padding: 0;
            min-height: 0;
          `}
          containerDisplayMode="inline-flex"
          showUnderline
        >
          {children}
        </ProgressHovercard>
      )}
    </ClassNames>
  );
}

const ActivityListContainer = styled('div')`
  width: 300px;
`;

const ProgressHovercard = styled(Hovercard)`
  width: auto;
`;

const HovercardBodyBoundary = styled('div')`
  padding: ${p => p.theme.space.md};
  max-height: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
`;
