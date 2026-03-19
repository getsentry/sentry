import type {ReactNode} from 'react';
import {Activity, Fragment} from 'react';

import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {AdminSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/admin/adminSecondaryNavigation';
import {DashboardsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsSecondaryNavigation';
import {ExploreSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/explore/exploreSecondaryNavigation';
import {InsightsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/insights/insightsSecondaryNavigation';
import {IssuesSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/issues/issuesSecondaryNavigation';
import {MonitorsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/monitors/monitorsSecondaryNavigation';
import {SettingsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/settings/settingsSecondaryNavigation';

export function SecondaryNavigationContent(): ReactNode {
  const {activeGroup} = usePrimaryNavigation();

  return (
    <Fragment>
      <Activity mode={activeGroup === 'issues' ? 'visible' : 'hidden'}>
        <IssuesSecondaryNavigation />
      </Activity>
      <Activity mode={activeGroup === 'insights' ? 'visible' : 'hidden'}>
        <InsightsSecondaryNavigation />
      </Activity>
      <Activity mode={activeGroup === 'dashboards' ? 'visible' : 'hidden'}>
        <DashboardsSecondaryNavigation />
      </Activity>
      <Activity mode={activeGroup === 'explore' ? 'visible' : 'hidden'}>
        <ExploreSecondaryNavigation />
      </Activity>
      <Activity mode={activeGroup === 'monitors' ? 'visible' : 'hidden'}>
        <MonitorsSecondaryNavigation />
      </Activity>
      <Activity mode={activeGroup === 'settings' ? 'visible' : 'hidden'}>
        <SettingsSecondaryNavigation />
      </Activity>
      <Activity mode={activeGroup === 'admin' ? 'visible' : 'hidden'}>
        <AdminSecondaryNavigation />
      </Activity>
    </Fragment>
  );
}
