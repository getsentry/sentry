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
import {GroupMergedView} from 'sentry/views/issueDetails/groupMerged';

export function MergedIssuesDrawer({group, project}: {group: Group; project: Project}) {
  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Merged Issues'),
            leadingGraphic: <ProjectAvatar project={project} size={16} />,
          }}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Merged Issues')}</Header>
      </EventNavigator>
      <EventDrawerBody>
        <GroupMergedView project={project} groupId={group.id} />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
