import type {ReactNode} from 'react';

import {unreachable} from 'sentry/utils/unreachable';
import {AdminSecondaryNav} from 'sentry/views/nav/secondary/sections/admin/adminSecondaryNav';
import {DashboardsSecondaryNav} from 'sentry/views/nav/secondary/sections/dashboards/dashboardsSecondaryNav';
import {ExploreSecondaryNav} from 'sentry/views/nav/secondary/sections/explore/exploreSecondaryNav';
import {InsightsSecondaryNav} from 'sentry/views/nav/secondary/sections/insights/insightsSecondaryNav';
import {IssuesSecondaryNav} from 'sentry/views/nav/secondary/sections/issues/issuesSecondaryNav';
import {MonitorsSecondaryNav} from 'sentry/views/nav/secondary/sections/monitors/monitorsSecondaryNav';
import {SettingsSecondaryNav} from 'sentry/views/nav/secondary/sections/settings/settingsSecondaryNav';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export function SecondaryNavContent({group}: {group: PrimaryNavGroup}): ReactNode {
  switch (group) {
    case PrimaryNavGroup.ISSUES:
      return <IssuesSecondaryNav />;
    case PrimaryNavGroup.INSIGHTS:
      return <InsightsSecondaryNav />;
    case PrimaryNavGroup.DASHBOARDS:
      return <DashboardsSecondaryNav />;
    case PrimaryNavGroup.EXPLORE:
      return <ExploreSecondaryNav />;
    case PrimaryNavGroup.MONITORS:
      return <MonitorsSecondaryNav />;
    case PrimaryNavGroup.PREVENT:
      return null;
    case PrimaryNavGroup.SETTINGS:
      return <SettingsSecondaryNav />;
    case PrimaryNavGroup.ADMIN:
      return <AdminSecondaryNav />;
    default:
      unreachable(group);
      return null;
  }
}
