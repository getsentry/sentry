import {Fragment} from 'react';
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
import {HeaderContainer, Layout} from 'sentry/stories/view/index';
import {SidebarContainer} from 'sentry/stories/view/storySidebar';
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
              <Fragment>
                <Heading as="h2" variant="success">
                  {selectedSource.label}
                  <Tag type="success">{selectedSource.category.label}</Tag>
                </Heading>
                <EmailPreview />
                <SlackPreview />
                <DiscordPreview />
                <TeamsPreview />
              </Fragment>
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

// const SourceTitle = styled('h2')`
//   margin-bottom: ${p => p.theme.space.md};
//   display: flex;
//   align-items: center;
//   gap: ${p => p.theme.space.md};
// `;
