import {Fragment, useCallback, useMemo, useState} from 'react';

import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Note} from 'sentry/components/activity/note';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import GroupActivityItem from 'sentry/views/issueDetails/groupActivityItem';

interface GroupActivitiesResponse {
  activity: GroupActivity[];
  pageLinks?: string | null;
}

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
  const [additionalActivities, setAdditionalActivities] = useState<GroupActivity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const me = useUser();
  const projectSlugs = group?.project ? [group.project.slug] : [];
  const noteProps = {
    minHeight: 140,
    group,
    projectSlugs,
    placeholder: placeholderText,
  };

  // Combine initial activities with additional loaded activities
  const allActivities = useMemo(() => {
    return [...group.activity, ...additionalActivities];
  }, [group.activity, additionalActivities]);

  // Check if we should show "Load More" button
  // If we have exactly 100 activities from the initial load, there might be more
  const shouldShowLoadMore = useMemo(() => {
    return group.activity.length >= 100 || nextCursor;
  }, [group.activity.length, nextCursor]);

  const loadMoreActivities = useCallback(async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const response = await fetch(
        `/api/0/organizations/${organization.slug}/issues/${group.id}/activities/?cursor=${nextCursor || ''}&limit=100`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load more activities');
      }

      const data: GroupActivitiesResponse = await response.json();
      const linkHeader = response.headers.get('Link');

      // Parse pagination info
      let newNextCursor = null;
      if (linkHeader) {
        const links = parseLinkHeader(linkHeader);
        newNextCursor = links?.next?.cursor || null;
      }

      setAdditionalActivities((prev: GroupActivity[]) => [...prev, ...data.activity]);
      setNextCursor(newNextCursor);
    } catch (error) {
      // Handle error silently for now, could add error state later
      console.error('Failed to load more activities:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [organization.slug, group.id, nextCursor, isLoadingMore]);

  const renderActivity = useCallback(
    (item: GroupActivity) => {
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
    },
    [group, organization, onDelete, onUpdate, noteProps]
  );

  return (
    <Fragment>
      <ActivityItem noPadding author={{type: 'user', user: me}}>
        <NoteInputWithStorage
          key={inputId}
          storageKey="groupinput:latest"
          itemKey={group.id}
          onCreate={(n: NoteType) => {
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

      {allActivities.map(renderActivity)}

      {shouldShowLoadMore && (
        <ActivityItem>
          <Button
            onClick={loadMoreActivities}
            disabled={isLoadingMore}
            priority="link"
            size="sm"
          >
            {isLoadingMore ? (
              <React.Fragment>
                <LoadingIndicator mini />
                {t('Loading...')}
              </React.Fragment>
            ) : (
              t('Load More Activities')
            )}
          </Button>
        </ActivityItem>
      )}
    </Fragment>
  );
}

export default ActivitySection;
