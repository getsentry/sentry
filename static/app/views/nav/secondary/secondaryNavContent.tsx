import type {ReactNode} from 'react';

import {unreachable} from 'sentry/utils/unreachable';
import {AdminSecondaryNav} from 'sentry/views/nav/secondary/sections/admin/adminSecondaryNav';
import CodecovSecondaryNav from 'sentry/views/nav/secondary/sections/codecov/codecovSecondaryNav';
import {DashboardsSecondaryNav} from 'sentry/views/nav/secondary/sections/dashboards/dashboardsSecondaryNav';
import {ExploreSecondaryNav} from 'sentry/views/nav/secondary/sections/explore/exploreSecondaryNav';
import {InsightsSecondaryNav} from 'sentry/views/nav/secondary/sections/insights/insightsSecondaryNav';
import {IssuesSecondaryNav} from 'sentry/views/nav/secondary/sections/issues/issuesSecondaryNav';
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
    case PrimaryNavGroup.CODECOV:
      return <CodecovSecondaryNav />;
    case PrimaryNavGroup.SETTINGS:
      return <SettingsSecondaryNav />;
    case PrimaryNavGroup.ADMIN:
      return <AdminSecondaryNav />;
    default:
      unreachable(group);
      return null;
  }
}
