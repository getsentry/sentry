import type {ReactNode} from 'react';

import {unreachable} from 'sentry/utils/unreachable';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/primary/config';
import {AdminSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/admin/adminSecondaryNavigation';
import {DashboardsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsSecondaryNavigation';
import {ExploreSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/explore/exploreSecondaryNavigation';
import {InsightsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/insights/insightsSecondaryNavigation';
import {IssuesSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/issues/issuesSecondaryNavigation';
import {MonitorsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/monitors/monitorsSecondaryNavigation';
import {SettingsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/settings/settingsSecondaryNavigation';

export function SecondaryNavigationContent({
  group,
}: {
  group: PrimaryNavigationGroup;
}): ReactNode {
  switch (group) {
    case PrimaryNavigationGroup.ISSUES:
      return <IssuesSecondaryNavigation />;
    case PrimaryNavigationGroup.INSIGHTS:
      return <InsightsSecondaryNavigation />;
    case PrimaryNavigationGroup.DASHBOARDS:
      return <DashboardsSecondaryNavigation />;
    case PrimaryNavigationGroup.EXPLORE:
      return <ExploreSecondaryNavigation />;
    case PrimaryNavigationGroup.MONITORS:
      return <MonitorsSecondaryNavigation />;
    case PrimaryNavigationGroup.PREVENT:
      return null;
    case PrimaryNavigationGroup.SETTINGS:
      return <SettingsSecondaryNavigation />;
    case PrimaryNavigationGroup.ADMIN:
      return <AdminSecondaryNavigation />;
    default:
      unreachable(group);
      return null;
  }
}
