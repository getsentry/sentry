import styled from '@emotion/styled';

import {DiscordPreview} from 'sentry/debug/notifs/components/discordPreview';
import {EmailPreview} from 'sentry/debug/notifs/components/emailPreview';
import {Header} from 'sentry/debug/notifs/components/header';
import {Sidebar} from 'sentry/debug/notifs/components/sidebar';
import {SlackPreview} from 'sentry/debug/notifs/components/slackPreview';
import {TeamsPreview} from 'sentry/debug/notifs/components/teamsPreview';
import {SidebarContainer} from 'sentry/stories/view/storySidebar';
import {space} from 'sentry/styles/space';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

export default function NotifsIndex() {
  return (
    <RouteAnalyticsContextProvider>
      <OrganizationContainer>
        <Layout>
          <HeaderContainer>
            <Header />
          </HeaderContainer>
          <SidebarContainer>
            <Sidebar />
          </SidebarContainer>
          <BodyContainer>
            <EmailPreview />
            <SlackPreview />
            <DiscordPreview />
            <TeamsPreview />
          </BodyContainer>
        </Layout>
      </OrganizationContainer>
    </RouteAnalyticsContextProvider>
  );
}

const Layout = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 256px minmax(auto, 1fr);
  place-items: stretch;
  min-height: calc(100dvh - 52px);
  padding-bottom: ${space(4)};
  position: absolute;
  top: 52px;
  left: 0;
  right: 0;
`;

const HeaderContainer = styled('div')`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${p => p.theme.zIndex.header};
  background: ${p => p.theme.tokens.background.primary};
`;

const BodyContainer = styled('div')`
  grid-row: 1;
  grid-column: 2;
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
