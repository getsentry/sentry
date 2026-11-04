import {ProjectAvatar} from '@sentry/scraps/avatar';

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
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {GroupSimilarIssues} from 'sentry/views/issueDetails/groupSimilarIssues/similarIssues';

export function SimilarIssuesDrawer({group, project}: {group: Group; project: Project}) {
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
            {label: t('Similar Issues')},
          ]}
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
