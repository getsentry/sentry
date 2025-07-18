import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {NotifEmptyState} from 'sentry/debug/notifs/components/notifEmptyState';
import {NotifHeader} from 'sentry/debug/notifs/components/notifHeader';
import {NotifSidebar} from 'sentry/debug/notifs/components/notifSidebar';
import {notificationCategories} from 'sentry/debug/notifs/data';
import {DiscordPreview} from 'sentry/debug/notifs/previews/discordPreview';
import {EmailPreview} from 'sentry/debug/notifs/previews/emailPreview';
import {SlackPreview} from 'sentry/debug/notifs/previews/slackPreview';
import {TeamsPreview} from 'sentry/debug/notifs/previews/teamsPreview';
import {HeaderContainer, Layout} from 'sentry/stories/view';
import {SidebarContainer} from 'sentry/stories/view/storySidebar';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

export default function NotifIndex() {
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
            <NotifHeader />
          </HeaderContainer>
          <SidebarContainer>
            <NotifSidebar />
          </SidebarContainer>
          <BodyContainer>
            {selectedSource ? (
              <Fragment>
                <SourceTitle>
                  {selectedSource.label}
                  <Tag type="success">{selectedSource.category.label}</Tag>
                </SourceTitle>
                <EmailPreview />
                <SlackPreview />
                <DiscordPreview />
                <TeamsPreview />
              </Fragment>
            ) : (
              <NotifEmptyState />
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
  gap: ${space(3)};
  padding: ${space(2)};
`;

const SourceTitle = styled('h2')`
  margin-bottom: ${space(1)};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
