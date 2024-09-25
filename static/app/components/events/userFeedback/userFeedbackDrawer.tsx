import styled from '@emotion/styled';

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
import {Body} from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import GroupUserFeedback from 'sentry/views/issueDetails/groupUserFeedback';

export function UserFeedbackDrawer({group, project}: {group: Group; project: Project}) {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {environments} = selection;

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
            {label: t('User Feedback')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('User Feedback')}</Header>
      </EventNavigator>
      <UserFeedbackBody>
        <GroupUserFeedback
          group={group}
          project={project}
          location={location}
          params={{
            groupId: group.id,
            orgId: organization.slug,
          }}
          environments={environments}
        />
      </UserFeedbackBody>
    </EventDrawerContainer>
  );
}

/* Disable grid from Layout styles in drawer */
const UserFeedbackBody = styled(EventDrawerBody)`
  ${Body} {
    grid-template-columns: unset;
  }
`;
