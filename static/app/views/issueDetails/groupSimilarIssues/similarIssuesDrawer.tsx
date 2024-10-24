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
import useOrganization from 'sentry/utils/useOrganization';
import GroupSimilarIssues from 'sentry/views/issueDetails/groupSimilarIssues/similarIssues';

export function SimilarIssuesDrawer({group, project}: {group: Group; project: Project}) {
  const organization = useOrganization();
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
            {label: t('Similar Issues')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Similar Issues')}</Header>
      </EventNavigator>
      <EventDrawerBody>
        <GroupSimilarIssues
          location={location}
          params={{
            groupId: group.id,
            orgId: organization.id,
          }}
          project={project}
        />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
