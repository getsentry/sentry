import {Fragment, useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NoteBody} from 'sentry/components/activity/note/body';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
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
import {getActivityColorConfig} from 'sentry/views/issueDetails/activitySection/activityColorConfig';
import {ActivityMarker} from 'sentry/views/issueDetails/activitySection/activityMarker';
import {CommentActionsDropdown} from 'sentry/views/issueDetails/activitySection/commentActionsDropdown';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/activitySection/groupActivityIcons';
import {getGroupActivityItem} from 'sentry/views/issueDetails/activitySection/groupActivityItem';
import {useMutateActivity} from 'sentry/views/issueDetails/activitySection/useMutateActivity';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/sidebar/sidebar';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

function TimelineItem({
  item,
  handleDelete,
  onCommentEdited,
  group,
  teams,
  size,
  inputVariant,
  timestampUnitStyle,
}: {
  group: Group;
  handleDelete: (item: GroupActivity) => Promise<void>;
  inputVariant: 'compact' | 'full';
  item: GroupActivity;
  size: 'sm' | 'md';
  teams: Team[];
  onCommentEdited?: (activity: GroupActivity[]) => void;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}) {
  const organization = useOrganization();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const useTwoColumnLayout = organization.features.includes('issue-activity-feed-v2');
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
      marker={
        useTwoColumnLayout ? (
          <ActivityMarker item={item} color={colorConfig.icon} />
        ) : undefined
      }
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
    [group.activity, mutators, organization, onCommentDeleted]
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
      onCommentEdited={onCommentEdited}
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
      onCommentCreated={activity => {
        onCommentCreated?.(activity);
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
