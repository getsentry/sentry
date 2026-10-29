import type {ReactNode} from 'react';

import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {AdminSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/admin/adminSecondaryNavigation';
import {DashboardsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsSecondaryNavigation';
import {ExploreSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/explore/exploreSecondaryNavigation';
import {InboxSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/inbox/inboxSecondaryNavigation';
import {InsightsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/insights/insightsSecondaryNavigation';
import {IssuesSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/issues/issuesSecondaryNavigation';
import {MonitorsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/monitors/monitorsSecondaryNavigation';
import {ProjectsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/projects/projectsSecondaryNavigation';
import {SeerSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/seer/seerSecondaryNavigation';
import {SettingsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/settings/settingsSecondaryNavigation';

export function SecondaryNavigationContent(): ReactNode {
  const {activeGroup} = usePrimaryNavigation();
  const organization = useOrganization({allowNull: true});

  switch (activeGroup) {
    case 'inbox':
      return <InboxSecondaryNavigation />;
    case 'issues':
      return <IssuesSecondaryNavigation />;
    case 'insights':
      if (organization?.features.includes('insights-to-dashboards-ui-rollout')) {
        return <DashboardsSecondaryNavigation />;
      }
      return <InsightsSecondaryNavigation />;
    case 'dashboards':
      return <DashboardsSecondaryNavigation />;
    case 'explore':
      return <ExploreSecondaryNavigation />;
    case 'seer':
      return <SeerSecondaryNavigation />;
    case 'projects':
      return <ProjectsSecondaryNavigation />;
    case 'monitors':
      return <MonitorsSecondaryNavigation />;
    case 'prevent':
      return null;
    case 'settings':
      return <SettingsSecondaryNavigation />;
    case 'admin':
      return <AdminSecondaryNavigation />;
    default:
      unreachable(activeGroup);
      return null;
  }
}
