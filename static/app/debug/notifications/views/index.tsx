import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
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
          <DebugNotificationsSidebar />
          <BodyContainer>
            {selectedSource ? (
              <SourceContainer>
                <Heading as="h2" variant="success">
                  {selectedSource.label}
                  <Tag type="success">{selectedSource.category.label}</Tag>
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

const BodyContainer = styled('div')`
  grid-row: 1;
  grid-column: 2;
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['3xl']};
`;

const Layout = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  --stories-grid-space: 0;

  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 256px minmax(auto, 1fr);
  place-items: stretch;
  min-height: calc(100dvh - 52px);
  padding-bottom: ${p => p.theme.space['3xl']};
  position: absolute;
  top: 52px;
  left: 0;
  right: 0;
`;

const HeaderContainer = styled('header')`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${p => p.theme.zIndex.header};
  background: ${p => p.theme.tokens.background.primary};
`;

const SourceContainer = styled('div')`
  padding: ${p => p.theme.space['2xl']};
`;
