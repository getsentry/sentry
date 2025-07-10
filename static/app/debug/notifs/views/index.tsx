import styled from '@emotion/styled';

import {NotifHeader} from 'sentry/debug/notifs/components/notifHeader';
import {NotifSidebar} from 'sentry/debug/notifs/components/notifSidebar';
import {DiscordPreview} from 'sentry/debug/notifs/previews/discordPreview';
import {EmailPreview} from 'sentry/debug/notifs/previews/emailPreview';
import {SlackPreview} from 'sentry/debug/notifs/previews/slackPreview';
import {TeamsPreview} from 'sentry/debug/notifs/previews/teamsPreview';
import {HeaderContainer, Layout} from 'sentry/stories/view';
import {SidebarContainer} from 'sentry/stories/view/storySidebar';
import {space} from 'sentry/styles/space';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

export default function NotifIndex() {
  return (
    <RouteAnalyticsContextProvider>
      <OrganizationContainer>
        <Layout>
          <HeaderContainer>
            <NotifHeader />
          </HeaderContainer>
          <SidebarContainer>
            <NotifSidebar />
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

const BodyContainer = styled('div')`
  grid-row: 1;
  grid-column: 2;
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
