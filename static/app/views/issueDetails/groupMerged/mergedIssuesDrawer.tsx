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
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import GroupMergedView from 'sentry/views/issueDetails/groupMerged';

export function MergedIssuesDrawer({group, project}: {group: Group; project: Project}) {
  const location = useLocation();

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
            {label: t('Merged Issues')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Merged Issues')}</Header>
      </EventNavigator>
      <EventDrawerBody>
        <GroupMergedView project={project} groupId={group.id} location={location} />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
