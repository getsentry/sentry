import {DrawerHeader} from '@sentry/scraps/drawer';

import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
} from 'sentry/components/events/eventDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {GroupMergedView} from 'sentry/views/issueDetails/groupMerged';

export function MergedIssuesDrawer({group, project}: {group: Group; project: Project}) {
  return (
    <EventDrawerContainer>
      <DrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Merged Issues'),
          }}
        />
      </DrawerHeader>
      <EventDrawerBody>
        <GroupMergedView project={project} groupId={group.id} />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
