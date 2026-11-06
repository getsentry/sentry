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
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';

import {GroupSimilarIssues} from './similarIssues';

export function SimilarIssuesDrawer({group}: {group: Group}) {
  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Similar Issues'),
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
