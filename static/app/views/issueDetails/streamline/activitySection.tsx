import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NoteBody} from 'sentry/components/activity/note/body';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import Timeline from 'sentry/components/timeline';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/streamline/groupActivityIcons';
import getGroupActivityItem from 'sentry/views/issueDetails/streamline/groupActivityItem';
import {NoteDropdown} from 'sentry/views/issueDetails/streamline/noteDropdown';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar';

function TimelineItem({
  item,
  handleDelete,
  group,
  teams,
}: {
  group: Group;
  handleDelete: (item: GroupActivity) => void;
  item: GroupActivity;
  teams: Team[];
}) {
  const organization = useOrganization();
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
    ? iconMapping.componentFunction(item.data)
    : iconMapping?.Component ?? null;

  return (
    <ActivityTimelineItem
      title={
        <Flex gap={space(0.5)} align="center" justify="flex-start">
          <TitleTooltip title={title} showOnlyOnOverflow skipWrapper>
            {title}
          </TitleTooltip>
          {item.type === GroupActivityType.NOTE && (
            <TitleDropdown onDelete={() => handleDelete(item)} user={item.user} />
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
      {typeof message === 'string' ? (
        <NoteWrapper>
          <NoteBody text={message} />
        </NoteWrapper>
      ) : (
        message
      )}
    </ActivityTimelineItem>
  );
}

export default function StreamlinedActivitySection({group}: {group: Group}) {
  const organization = useOrganization();
  const {teams} = useTeamsById();
  const [showAll, setShowAll] = useState(false);

  const [inputId, setInputId] = useState(uniqueId());

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
            trackAnalytics('issue_details.comment_deleted', {organization});
            addSuccessMessage(t('Comment removed'));
          },
        }
      );
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
          trackAnalytics('issue_details.comment_created', {organization});
          addSuccessMessage(t('Comment posted'));
        },
      });
    },
    [group.activity, mutators, group.id, organization]
  );

  return (
    <div>
      <Flex justify="space-between" align="center">
        <SidebarSectionTitle>{t('Activity')}</SidebarSectionTitle>
        {showAll && (
          <TextButton
            borderless
            size="zero"
            onClick={() => setShowAll(false)}
            analyticsEventKey="issue_details.activity_collapsed"
            analyticsEventName="Issue Details: Activity Collapsed"
            analyticsParams={{num_activities: group.activity.length}}
          >
            {t('Collapse')}
          </TextButton>
        )}
      </Flex>
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
        {(group.activity.length < 5 || showAll) &&
          group.activity.map(item => {
            return (
              <TimelineItem
                item={item}
                handleDelete={handleDelete}
                group={group}
                teams={teams}
                key={item.id}
              />
            );
          })}
        {!showAll && group.activity.length >= 5 && (
          <Fragment>
            {group.activity.slice(0, 2).map(item => {
              return (
                <TimelineItem
                  item={item}
                  handleDelete={handleDelete}
                  group={group}
                  teams={teams}
                  key={item.id}
                />
              );
            })}
            <ActivityTimelineItem
              title={
                <TextButton
                  aria-label={t('Show all activity')}
                  onClick={() => setShowAll(true)}
                  borderless
                  size="zero"
                  analyticsEventKey="issue_details.activity_expanded"
                  analyticsEventName="Issue Details: Activity Expanded"
                  analyticsParams={{
                    num_activities_hidden: group.activity.length - 3,
                  }}
                >
                  {t('%s activities hidden', group.activity.length - 3)}
                </TextButton>
              }
              icon={<RotatedEllipsisIcon direction={'up'} />}
            />
            <TimelineItem
              item={group.activity[group.activity.length - 1]}
              handleDelete={handleDelete}
              group={group}
              teams={teams}
              key={group.activity[group.activity.length - 1].id}
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

const TextButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const RotatedEllipsisIcon = styled(IconEllipsis)`
  transform: rotate(90deg) translateY(1px);
`;

const NoteWrapper = styled('div')`
  ${textStyles}
`;
