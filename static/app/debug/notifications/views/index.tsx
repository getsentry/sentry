import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {DebugNotificationsHeader} from 'sentry/debug/notifications/components/debugNotificationsHeader';
import {DebugNotificationsLanding} from 'sentry/debug/notifications/components/debugNotificationsLanding';
import {DebugNotificationsSidebar} from 'sentry/debug/notifications/components/debugNotificationsSidebar';
import {notificationCategories} from 'sentry/debug/notifications/data';
import {DiscordPreview} from 'sentry/debug/notifications/previews/discordPreview';
import {EmailPreview} from 'sentry/debug/notifications/previews/emailPreview';
import {SlackPreview} from 'sentry/debug/notifications/previews/slackPreview';
import {TeamsPreview} from 'sentry/debug/notifications/previews/teamsPreview';
import {useLocation} from 'sentry/utils/useLocation';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

const HEADER_HEIGHT = 52;

export default function DebugNotificationsIndex() {
  const location = useLocation();
  const notificationSources = notificationCategories.flatMap(
    category => category.sources
  );
  const selectedSource = notificationSources.find(
    source => location.query.source === source.value
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
            {selectedSource ? (
              <Flex direction="column" gap="xl" padding="2xl">
                <Heading as="h2" variant="success">
                  <Flex gap="md" align="center">
                    {selectedSource.label}
                    <Tag type="success">{selectedSource.category.label}</Tag>
                  </Flex>
                </Heading>
                <EmailPreview />
                <SlackPreview />
                <DiscordPreview />
                <TeamsPreview />
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
  scrollbar-color: ${p => p.theme.tokens.border.primary} ${p => p.theme.background};
  display: flex;
  flex-direction: column;
`;
