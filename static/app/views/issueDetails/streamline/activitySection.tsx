import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NoteBody} from 'sentry/components/activity/note/body';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import Timeline from 'sentry/components/timeline';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {uniqueId} from 'sentry/utils/guid';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import type {MutateActivityOptions} from 'sentry/views/issueDetails/groupActivity';
import {groupActivityTypeIconMapping} from 'sentry/views/issueDetails/streamline/groupActivityIcons';
import getGroupActivityItem from 'sentry/views/issueDetails/streamline/groupActivityItem';
import {NoteDropdown} from 'sentry/views/issueDetails/streamline/noteDropdown';

function StreamlinedActivitySection({group}: {group: Group}) {
  const organization = useOrganization();
  const {teams} = useTeamsById();

  const [inputId, setInputId] = useState(uniqueId());

  const me = ConfigStore.get('user');
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

  const deleteOptions: MutateActivityOptions = useMemo(() => {
    return {
      onError: () => {
        addErrorMessage(t('Failed to delete comment'));
      },
      onSuccess: () => {
        addSuccessMessage(t('Comment removed'));
      },
    };
  }, []);

  const createOptions: MutateActivityOptions = useMemo(() => {
    return {
      onError: () => {
        addErrorMessage(t('Unable to post comment'));
      },
      onSuccess: data => {
        GroupStore.addActivity(group.id, data);
        addSuccessMessage(t('Comment posted'));
      },
    };
  }, [group.id]);

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
        deleteOptions
      );
    },
    [deleteOptions, group.activity, mutators, group.id]
  );

  const handleCreate = useCallback(
    (n: NoteType, _me: User) => {
      mutators.handleCreate(n, group.activity, createOptions);
    },
    [createOptions, group.activity, mutators]
  );

  return (
    <Fragment>
      <Timeline.Container>
        <NoteInputWithStorage
          key={inputId}
          storageKey="groupinput:latest"
          itemKey={group.id}
          onCreate={n => {
            handleCreate(n, me);
            setInputId(uniqueId());
          }}
          source="issue-details"
          {...noteProps}
        />
        {group.activity.map(item => {
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
                  <NoteDropdown onDelete={() => handleDelete(item)} />
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

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  font-weight: normal;
`

const ActivityTimelineItem = styled(Timeline.Item)`
  align-items: center;
`;

const SmallTimestamp = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default StreamlinedActivitySection;
