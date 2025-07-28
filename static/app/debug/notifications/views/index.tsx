import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
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
        <Layout>
          <HeaderContainer>
            <DebugNotificationsHeader />
          </HeaderContainer>
          <SidebarContainer>
            <DebugNotificationsSidebar />
          </SidebarContainer>
          <BodyContainer>
            {selectedSource ? (
              <SourceContainer>
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
              </SourceContainer>
            ) : (
              <DebugNotificationsLanding />
            )}
          </BodyContainer>
        </Layout>
      </OrganizationContainer>
    </RouteAnalyticsContextProvider>
  );
}

const Layout = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  display: grid;
  grid-template-rows: 52px 1fr;
  grid-template-columns: 256px minmax(auto, 1fr);
  grid-template-areas:
    'header header'
    'sidebar body';
  min-height: 100dvh;
`;

const HeaderContainer = styled('header')`
  grid-area: header;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${p => p.theme.zIndex.header};
  background: ${p => p.theme.tokens.background.primary};
`;

const SidebarContainer = styled('nav')`
  grid-area: sidebar;
  overflow-y: auto;
  max-height: calc(100dvh - 52px);
  box-shadow: 1px 0 0 0 ${p => p.theme.tokens.border.primary};
  scrollbar-width: thin;
  scrollbar-color: ${p => p.theme.tokens.border.primary} ${p => p.theme.background};
  display: flex;
  flex-direction: column;
`;

const BodyContainer = styled('div')`
  grid-area: body;
  display: flex;
  flex-direction: column;
`;

const SourceContainer = styled('div')`
  padding: ${p => p.theme.space['2xl']};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
`;
