import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {DebugNotificationsExample} from 'sentry/debug/notifications/components/debugNotificationsExample';
import {DebugNotificationsHeader} from 'sentry/debug/notifications/components/debugNotificationsHeader';
import {DebugNotificationsLanding} from 'sentry/debug/notifications/components/debugNotificationsLanding';
import {DebugNotificationsSidebar} from 'sentry/debug/notifications/components/debugNotificationsSidebar';
import {useRegistry} from 'sentry/debug/notifications/hooks/useRegistry';
import {useRouteSource} from 'sentry/debug/notifications/hooks/useRouteSource';
import {DiscordPreview} from 'sentry/debug/notifications/previews/discordPreview';
import {EmailPreview} from 'sentry/debug/notifications/previews/emailPreview';
import {SlackPreview} from 'sentry/debug/notifications/previews/slackPreview';
import {TeamsPreview} from 'sentry/debug/notifications/previews/teamsPreview';
import {OrganizationContainer} from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

const HEADER_HEIGHT = 52;

export default function DebugNotificationsIndex() {
  const {routeSource} = useRouteSource();
  const {data: registry = {}} = useRegistry();
  const registrations = Object.values(registry).flat();
  const selectedRegistration = registrations.find(
    registration => routeSource === registration.source
  );
  return (
    <RouteAnalyticsContextProvider>
      <OrganizationContainer>
        <Grid
          rows={`${HEADER_HEIGHT}px 1fr`}
          columns="256px minmax(auto, 1fr)"
          minHeight="100dvh"
          areas={`
            "header header"
            "sidebar body"
          `}
          background="primary"
          position="relative"
        >
          <HeaderContainer>
            <DebugNotificationsHeader />
          </HeaderContainer>
          <SidebarContainer>
            <DebugNotificationsSidebar />
          </SidebarContainer>
          <Flex direction="column" area="body">
            {selectedRegistration ? (
              <Flex direction="column" gap="xl" padding="2xl" maxWidth="2000px">
                <Heading as="h2" variant="success">
                  <Flex gap="md" align="center">
                    {selectedRegistration.source}
                    <Tag variant="success">{selectedRegistration.category}</Tag>
                  </Flex>
                </Heading>
                <Grid columns={{md: '1fr', lg: '1fr auto'}} gap="2xl" position="relative">
                  <Flex
                    direction="column"
                    position="relative"
                    minWidth="400px"
                    justify="start"
                  >
                    <EmailPreview registration={selectedRegistration} />
                    <SlackPreview registration={selectedRegistration} />
                    <DiscordPreview registration={selectedRegistration} />
                    <TeamsPreview registration={selectedRegistration} />
                  </Flex>
                  <ExampleContainer>
                    <DebugNotificationsExample registration={selectedRegistration} />
                  </ExampleContainer>
                </Grid>
              </Flex>
            ) : (
              <DebugNotificationsLanding />
            )}
          </Flex>
        </Grid>
      </OrganizationContainer>
    </RouteAnalyticsContextProvider>
  );
}

const HeaderContainer = styled('header')`
  grid-area: header;
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${p => p.theme.zIndex.header};
  background: ${p => p.theme.tokens.background.primary};
`;

const SidebarContainer = styled('nav')`
  grid-area: sidebar;
  position: sticky;
  top: ${HEADER_HEIGHT}px;
  overflow-y: auto;
  max-height: calc(100dvh - ${HEADER_HEIGHT}px);
  box-shadow: 1px 0 0 0 ${p => p.theme.tokens.border.primary};
  scrollbar-width: thin;
  scrollbar-color: ${p => p.theme.tokens.border.primary}
    ${p => p.theme.tokens.background.primary};
  display: flex;
  flex-direction: column;
`;

const ExampleContainer = styled('div')`
  position: sticky;
  top: ${p => `calc(${HEADER_HEIGHT}px + ${p.theme.space.xl})`};
  align-self: flex-start;
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    max-width: 450px;
  }
`;
