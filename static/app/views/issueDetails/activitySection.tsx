import {Fragment, useState} from 'react';

import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Note} from 'sentry/components/activity/note';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import GroupActivityItem from 'sentry/views/issueDetails/groupActivityItem';

type Props = {
  group: Group;
  onCreate: (n: NoteType, me: User) => void;
  onDelete: (item: GroupActivity) => void;
  onUpdate: (item: GroupActivity, n: NoteType) => void;
  placeholderText: string;
};

function ActivitySection(props: Props) {
  const {group, placeholderText, onCreate, onDelete, onUpdate} = props;
  const organization = useOrganization();

  const [inputId, setInputId] = useState(uniqueId());

  const me = useUser();
  const projectSlugs = group?.project ? [group.project.slug] : [];
  const noteProps = {
    minHeight: 140,
    group,
    projectSlugs,
    placeholder: placeholderText,
  };

  return (
    <Fragment>
      <ActivityItem noPadding author={{type: 'user', user: me}}>
        <NoteInputWithStorage
          key={inputId}
          storageKey="groupinput:latest"
          itemKey={group.id}
          onCreate={n => {
            onCreate(n, me);
            trackAnalytics('issue_details.comment_created', {
              organization,
              org_streamline_only: organization.streamlineOnly ?? undefined,
              streamline: false,
            });
            setInputId(uniqueId());
          }}
          source="activity"
          {...noteProps}
        />
      </ActivityItem>

      {group.activity.map(item => {
        const authorName = item.user ? item.user.name : 'Sentry';

        if (item.type === GroupActivityType.NOTE) {
          return (
            <ErrorBoundary mini key={`note-${item.id}`}>
              <Note
                showTime={false}
                text={item.data.text}
                noteId={item.id}
                user={item.user as User}
                dateCreated={item.dateCreated}
                authorName={authorName}
                onDelete={() => {
                  onDelete(item);
                  trackAnalytics('issue_details.comment_deleted', {
                    organization,
                    streamline: false,
                    org_streamline_only: organization.streamlineOnly ?? undefined,
                  });
                }}
                onUpdate={n => {
                  item.data.text = n.text;
                  onUpdate(item, n);
                  trackAnalytics('issue_details.comment_updated', {
                    organization,
                    streamline: false,
                    org_streamline_only: organization.streamlineOnly ?? undefined,
                  });
                }}
                {...noteProps}
              />
            </ErrorBoundary>
          );
        }

        return (
          <ErrorBoundary mini key={`item-${item.id}`}>
            <ActivityItem
              author={{
                type: item.user ? 'user' : 'system',
                user: item.user ?? undefined,
              }}
              date={item.dateCreated}
              header={
                <GroupActivityItem
                  author={<ActivityAuthor>{authorName}</ActivityAuthor>}
                  activity={item}
                  organization={organization}
                  projectId={group.project.id}
                  group={group}
                />
              }
            />
          </ErrorBoundary>
        );
      })}
    </Fragment>
  );
}

export default ActivitySection;
