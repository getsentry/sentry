import type {ReactNode} from 'react';

import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';

import {AdminSecondaryNavigation} from './sections/admin/adminSecondaryNavigation';
import {DashboardsSecondaryNavigation} from './sections/dashboards/dashboardsSecondaryNavigation';
import {ExploreSecondaryNavigation} from './sections/explore/exploreSecondaryNavigation';
import {InboxSecondaryNavigation} from './sections/inbox/inboxSecondaryNavigation';
import {InsightsSecondaryNavigation} from './sections/insights/insightsSecondaryNavigation';
import {IssuesSecondaryNavigation} from './sections/issues/issuesSecondaryNavigation';
import {MonitorsSecondaryNavigation} from './sections/monitors/monitorsSecondaryNavigation';
import {ProjectsSecondaryNavigation} from './sections/projects/projectsSecondaryNavigation';
import {SeerSecondaryNavigation} from './sections/seer/seerSecondaryNavigation';
import {SettingsSecondaryNavigation} from './sections/settings/settingsSecondaryNavigation';

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
