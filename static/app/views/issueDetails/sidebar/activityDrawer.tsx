import {useSearchParams} from 'react-router-dom';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

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
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';

interface ActivityDrawerProps {
  group: Group;
  project: Project;
}

export function ActivityDrawer({group, project}: ActivityDrawerProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') ?? 'all';
  const organization = useOrganization();

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
          <SegmentedControl.Item key="comments">
            {t('Comments Only')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="all">{t('All Activity')}</SegmentedControl.Item>
        </SegmentedControl>
      </EventNavigator>
      <EventDrawerBody>
        <ActivitySection
          group={group}
          variant="standalone"
          size="md"
          filterComments={filter === 'comments'}
          minHeight={72}
          placeholder={t('Add a comment. Tag users with @, or teams with #')}
        />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
