import {useEffect, useState} from 'react';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
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
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/sidebar/activitySection';

interface ActivityDrawerProps {
  group: Group;
  project: Project;
}

export function ActivityDrawer({group, project}: ActivityDrawerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [filterComments, setFilterComments] = useState(
    location.query.filter === 'comments'
  );

  useEffect(() => {
    if (location.query.filter) {
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            filter: undefined,
          },
        },
        {replace: true}
      );
    }
  }, [location, navigate]);

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
          value={filterComments ? 'comments' : 'all'}
          onChange={() => setFilterComments(!filterComments)}
        >
          <SegmentedControl.Item key="comments">
            {t('Comments Only')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="all">{t('All Activity')}</SegmentedControl.Item>
        </SegmentedControl>
      </EventNavigator>
      <EventDrawerBody>
        <StreamlinedActivitySection
          group={group}
          isDrawer
          filterComments={filterComments}
        />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
