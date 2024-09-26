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
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import GroupReplays, {
  StyledLayoutPage,
} from 'sentry/views/issueDetails/groupReplays/groupReplays';

export function ReplayDrawer({group, project}: {group: Group; project: Project}) {
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
            {label: t('Replays')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Replays')}</Header>
      </EventNavigator>
      <ReplayBody>
        <GroupReplays group={group} />
      </ReplayBody>
    </EventDrawerContainer>
  );
}

const ReplayBody = styled(EventDrawerBody)`
  ${StyledLayoutPage} {
    box-shadow: unset;
    padding: unset;
  }
`;
