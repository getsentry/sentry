import {ClassNames, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {NoteBody} from 'sentry/components/activity/note/body';
import {Hovercard} from 'sentry/components/hovercard';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Timeline} from 'sentry/components/timeline';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {getActivityColorConfig} from 'sentry/views/issueDetails/activitySection/activityColorConfig';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/activitySection/groupActivityIcons';
import {getGroupActivityItem} from 'sentry/views/issueDetails/activitySection/groupActivityItem';

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
  const organization = useOrganization();
  const theme = useTheme();
  const {teams} = useTeamsById();

  const colorConfig = getActivityColorConfig(theme, item.type);
  const {title, message} = getGroupActivityItem(
    item,
    organization,
    group.project,
    group.issueCategory,
    teams
  );

  const iconMapping = groupActivityTypeIconMapping[item.type];
  const componentFunction =
    item.type === GroupActivityType.NOTE ? undefined : iconMapping?.componentFunction;
  const Icon = componentFunction
    ? componentFunction({
        data: item.data,
        user: item.user,
        sentry_app: item.sentry_app,
      })
    : (iconMapping?.Component ?? null);

  return (
    <Timeline.Item
      title={title}
      timestamp={<Timestamp date={item.dateCreated} unitStyle="extraShort" />}
      colorConfig={colorConfig}
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
      {typeof message === 'string' ? (
        <NoteBody text={message} />
      ) : message ? (
        <Text as="div" size="sm">
          {message}
        </Text>
      ) : null}
    </Timeline.Item>
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
      <TimelineContainer>
        <Flex align="center" justify="center" minHeight="40px">
          <LoadingIndicator size={24} />
        </Flex>
      </TimelineContainer>
    );
  }

  if (isError) {
    return (
      <TimelineContainer>
        <Flex align="center" justify="center" minHeight="40px">
          <Text variant="muted">{t('Failed to load activity.')}</Text>
        </Flex>
      </TimelineContainer>
    );
  }

  const items = getProgressActivities(data?.activity ?? []);

  if (items.length === 0) {
    return (
      <TimelineContainer>
        <Flex align="center" justify="center" minHeight="40px">
          <Text variant="muted">{t('No activity.')}</Text>
        </Flex>
      </TimelineContainer>
    );
  }

  return (
    <TimelineContainer>
      <Timeline.Container>
        {items.map(item => (
          <ProgressActivityItem key={item.id} group={group} item={item} />
        ))}
      </Timeline.Container>
    </TimelineContainer>
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

const Timestamp = styled(TimeSince)`
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
`;

const TimelineContainer = styled('div')`
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
