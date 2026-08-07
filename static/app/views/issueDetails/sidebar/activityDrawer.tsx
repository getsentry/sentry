import {useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Badge} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {isActivityNote} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';
import {issueCommentsQueryOptions} from 'sentry/views/issueDetails/activitySection/issueCommentsQueryOptions';
import {useGroupId} from 'sentry/views/issueDetails/groupIdContext';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

interface ActivityDrawerProps {
  project: Project;
}

const GROUP_ACTIVITY_LIMIT = 100;

export function ActivityDrawer({project}: ActivityDrawerProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') ?? 'all';
  const organization = useOrganization();
  const groupId = useGroupId();

  // Subscribe to the query cache directly so the drawer reflects mutations
  // (e.g. comment create/delete). The drawer's render function is captured in
  // a closure by openDrawer, so the group in context or props would go stale.
  const {data: group} = useGroup({groupId});
  const activityComments = group?.activity.filter(isActivityNote) ?? [];
  const shouldFetchComments =
    filter === 'comments' &&
    group !== undefined &&
    group.numComments > 0 &&
    group.activity.length >= GROUP_ACTIVITY_LIMIT;
  const commentsQuery = useQuery({
    ...issueCommentsQueryOptions({
      organizationSlug: organization.slug,
      groupId,
    }),
    enabled: shouldFetchComments,
  });

  if (!group) {
    return <LoadingIndicator />;
  }

  const comments = shouldFetchComments
    ? (commentsQuery.data ?? activityComments)
    : activityComments;

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: t('Activity')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Activity')}</Header>
        <SegmentedControl
          size="xs"
          aria-label={t('Filter activity')}
          value={filter}
          onChange={value => {
            trackAnalytics('issue_details.activity_drawer.filter_changed', {
              organization,
              filter: value,
            });
            setSearchParams(
              params => {
                if (value === 'comments') {
                  params.set('filter', 'comments');
                } else {
                  params.delete('filter');
                }
                return params;
              },
              {replace: true}
            );
          }}
        >
          <SegmentedControl.Item key="comments" textValue={t('Comments')}>
            <Flex as="span" align="center" gap="sm">
              {t('Comments')}
              {group.numComments > 0 ? (
                <Badge
                  aria-label={tn('%s comment', '%s comments', group.numComments)}
                  variant="muted"
                >
                  {group.numComments}
                </Badge>
              ) : null}
            </Flex>
          </SegmentedControl.Item>
          <SegmentedControl.Item key="all">{t('All activity')}</SegmentedControl.Item>
        </SegmentedControl>
      </EventNavigator>
      <EventDrawerBody>
        {shouldFetchComments && commentsQuery.isError ? (
          <Text variant="muted">{t('Unable to load comments.')}</Text>
        ) : null}
        {shouldFetchComments && commentsQuery.isPending ? (
          <LoadingIndicator />
        ) : (
          <ActivitySection
            group={group}
            activities={filter === 'comments' ? comments : group.activity}
            variant="standalone"
            filterComments={filter === 'comments'}
            minHeight={72}
            placeholder={t('Add a comment. Tag users with @, or teams with #')}
          />
        )}
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
