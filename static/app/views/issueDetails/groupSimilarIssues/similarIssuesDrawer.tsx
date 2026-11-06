import {DrawerHeader} from '@sentry/scraps/drawer';

import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
} from 'sentry/components/events/eventDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';

import {GroupSimilarIssues} from './similarIssues';

export function SimilarIssuesDrawer({group}: {group: Group}) {
  return (
    <EventDrawerContainer>
      <DrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Similar Issues'),
          }}
        />
      </DrawerHeader>
      <EventDrawerBody>
        <GroupIdProvider groupId={group.id}>
          <GroupSimilarIssues />
        </GroupIdProvider>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
