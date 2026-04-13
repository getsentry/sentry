import type {ReactNode} from 'react';

import {unreachable} from 'sentry/utils/unreachable';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {AdminSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/admin/adminSecondaryNavigation';
import {DashboardsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsSecondaryNavigation';
import {ExploreSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/explore/exploreSecondaryNavigation';
import {InsightsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/insights/insightsSecondaryNavigation';
import {IssuesSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/issues/issuesSecondaryNavigation';
import {MonitorsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/monitors/monitorsSecondaryNavigation';
import {ProjectsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/projects/projectsSecondaryNavigation';
import {SettingsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/settings/settingsSecondaryNavigation';

export function SecondaryNavigationContent(): ReactNode {
  const {activeGroup} = usePrimaryNavigation();
  switch (activeGroup) {
    case 'issues':
      return <IssuesSecondaryNavigation />;
    case 'insights':
      return <InsightsSecondaryNavigation />;
    case 'dashboards':
      return <DashboardsSecondaryNavigation />;
    case 'explore':
      return <ExploreSecondaryNavigation />;
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
