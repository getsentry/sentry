import {useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
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
import {IconChat} from 'sentry/icons';
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
        <FilterButton
          size="xs"
          borderless
          icon={<IconChat size="sm" />}
          title={filterComments ? t('Show all activity') : t('Filter for comments')}
          aria-label={t('Filter activity for comments')}
          onClick={() => setFilterComments(!filterComments)}
          filtered={filterComments}
        />
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

const FilterButton = styled(Button)<{filtered: boolean}>`
  color: ${p => (p.filtered ? p.theme.activeText : p.theme.subText)};
  background: ${p => (p.filtered ? p.theme.surface100 : 'transparent')};
`;
