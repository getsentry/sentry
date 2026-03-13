import type {ReactNode} from 'react';

import {unreachable} from 'sentry/utils/unreachable';
import {AdminSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/admin/adminSecondaryNavigation';
import {DashboardsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsSecondaryNavigation';
import {ExploreSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/explore/exploreSecondaryNavigation';
import {InsightsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/insights/insightsSecondaryNavigation';
import {IssuesSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/issues/issuesSecondaryNavigation';
import {MonitorsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/monitors/monitorsSecondaryNavigation';
import {SettingsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/settings/settingsSecondaryNavigation';
import {PRIMARY_NAVIGATION_GROUP_CONFIG} from 'sentry/views/navigation/useActiveNavigationGroup';

export function SecondaryNavigationContent({
  group,
}: {
  group: keyof typeof PRIMARY_NAVIGATION_GROUP_CONFIG;
}): ReactNode {
  switch (group) {
    case 'issues':
      return <IssuesSecondaryNavigation />;
    case 'insights':
      return <InsightsSecondaryNavigation />;
    case 'dashboards':
      return <DashboardsSecondaryNavigation />;
    case 'explore':
      return <ExploreSecondaryNavigation />;
    case 'monitors':
      return <MonitorsSecondaryNavigation />;
    case 'prevent':
      return null;
    case 'settings':
      return <SettingsSecondaryNavigation />;
    case 'admin':
      return <AdminSecondaryNavigation />;
    default:
      unreachable(group);
      return null;
  }
}
