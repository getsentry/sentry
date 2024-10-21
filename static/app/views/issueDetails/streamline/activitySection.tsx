import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NoteBody} from 'sentry/components/activity/note/body';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import Timeline from 'sentry/components/timeline';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Release} from 'sentry/types/release';
import type {User} from 'sentry/types/user';
import {uniqueId} from 'sentry/utils/guid';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/streamline/groupActivityIcons';
import getGroupActivityItem from 'sentry/views/issueDetails/streamline/groupActivityItem';
import {NoteDropdown} from 'sentry/views/issueDetails/streamline/noteDropdown';

export interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}
function StreamlinedActivitySection({group}: {group: Group}) {
  const organization = useOrganization();
  const {teams} = useTeamsById();

  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/first-last-release/`],
    {
      staleTime: 30000,
      gcTime: 30000,
    }
  );

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

  const activities = useMemo(() => {
    const lastSeenActivity: GroupActivity = {
      type: GroupActivityType.LAST_SEEN,
      id: uniqueId(),
      dateCreated: group.lastSeen,
      project: group.project,
      data: {},
    };

    const groupActivities = [...group.activity, lastSeenActivity];
    return groupActivities.sort((a, b) => {
      const dateA = new Date(a.dateCreated).getTime();
      const dateB = new Date(b.dateCreated).getTime();
      if (
        a.type === GroupActivityType.FIRST_SEEN &&
        b.type === GroupActivityType.LAST_SEEN
      ) {
        return 1;
      }
      if (
        a.type === GroupActivityType.LAST_SEEN &&
        b.type === GroupActivityType.FIRST_SEEN
      ) {
        return -1;
      }

      return dateB - dateA;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.activity.length, group.lastSeen, group.project]);

  return (
    <Fragment>
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
        {activities.map(item => {
          const authorName = item.user ? item.user.name : 'Sentry';
          const {title, message} = getGroupActivityItem(
            item,
            organization,
            group.project.id,
            <Author>{authorName}</Author>,
            teams,
            groupReleaseData
          );

          const Icon = groupActivityTypeIconMapping[item.type]?.Component ?? null;

          return (
            <ActivityTimelineItem
              title={
                <TitleWrapper>
                  {title}
                  <NoteDropdownWrapper>
                    {item.type === GroupActivityType.NOTE && (
                      <NoteDropdown
                        onDelete={() => handleDelete(item)}
                        user={item.user}
                      />
                    )}
                  </NoteDropdownWrapper>
                </TitleWrapper>
              }
              timestamp={<SmallTimestamp date={item.dateCreated} />}
              icon={
                Icon && (
                  <Icon
                    {...groupActivityTypeIconMapping[item.type].defaultProps}
                    size="xs"
                  />
                )
              }
              key={item.id}
            >
              {typeof message === 'string' ? <NoteBody text={message} /> : message}
            </ActivityTimelineItem>
          );
        })}
      </Timeline.Container>
    </Fragment>
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

export default StreamlinedActivitySection;
