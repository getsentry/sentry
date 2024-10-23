import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NoteBody} from 'sentry/components/activity/note/body';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import {Button} from 'sentry/components/button';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import Timeline from 'sentry/components/timeline';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
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
    group.project.id,
    <Author>{authorName}</Author>,
    teams
  );

  const Icon = groupActivityTypeIconMapping[item.type]?.Component ?? null;

  return (
    <ActivityTimelineItem
      title={
        <TitleWrapper>
          {title}
          <NoteDropdownWrapper>
            {item.type === GroupActivityType.NOTE && (
              <NoteDropdown onDelete={() => handleDelete(item)} user={item.user} />
            )}
          </NoteDropdownWrapper>
        </TitleWrapper>
      }
      timestamp={<SmallTimestamp date={item.dateCreated} />}
      icon={
        Icon && (
          <Icon {...groupActivityTypeIconMapping[item.type].defaultProps} size="xs" />
        )
      }
    >
      {typeof message === 'string' ? <NoteBody text={message} /> : message}
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
    placeholder: t('Add a comment...'),
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
            addSuccessMessage(t('Comment removed'));
          },
        }
      );
    },
    [group.activity, mutators, group.id]
  );

  const handleCreate = useCallback(
    (n: NoteType, _me: User) => {
      mutators.handleCreate(n, group.activity, {
        onError: () => {
          addErrorMessage(t('Unable to post comment'));
        },
        onSuccess: data => {
          GroupStore.addActivity(group.id, data);
          addSuccessMessage(t('Comment posted'));
        },
      });
    },
    [group.activity, mutators, group.id]
  );

  return (
    <div>
      <TitleSection>
        <SidebarSectionTitle>{t('Activity')}</SidebarSectionTitle>
        {showAll && (
          <CollapseButton borderless size="zero" onClick={() => setShowAll(false)}>
            {t('Collapse')}
          </CollapseButton>
        )}
      </TitleSection>
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
                <ShowAllButton
                  aria-label={t('Show all activity')}
                  onClick={() => setShowAll(true)}
                  borderless
                  size="zero"
                >
                  {t('%s comments hidden', group.activity.length - 3)}
                </ShowAllButton>
              }
              icon={<RotatedEllipsisIcon />}
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

const Author = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const NoteDropdownWrapper = styled('span')`
  font-weight: normal;
`;

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ActivityTimelineItem = styled(Timeline.Item)`
  align-items: center;
`;

const SmallTimestamp = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const ShowAllButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const TitleSection = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const CollapseButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const RotatedEllipsisIcon = styled(IconEllipsis)`
  transform: rotate(90deg);
`;
