import {ProjectAvatar} from '@sentry/scraps/avatar';

import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
} from 'sentry/components/events/eventDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';

import {GroupSimilarIssues} from './similarIssues';

export function SimilarIssuesDrawer({group, project}: {group: Group; project: Project}) {
  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Similar Issues'),
            leadingGraphic: <ProjectAvatar project={project} size={16} />,
          }}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Similar Issues')}</Header>
      </EventNavigator>
      <EventDrawerBody>
        <GroupIdProvider groupId={group.id}>
          <GroupSimilarIssues />
        </GroupIdProvider>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
