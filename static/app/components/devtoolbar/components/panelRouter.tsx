import {lazy} from 'react';

import useToolbarRoute from '../hooks/useToolbarRoute';

const PanelAlerts = lazy(() => import('./alerts/alertsPanel'));
const PanelFeedback = lazy(() => import('./feedback/feedbackPanel'));
const PanelIssues = lazy(() => import('./issues/issuesPanel'));
const PanelFeatureFlags = lazy(() => import('./featureFlags/featureFlagsPanel'));

export default function PanelRouter() {
  const {state} = useToolbarRoute();

  switch (state.activePanel) {
    case 'alerts':
      return <PanelAlerts />;
    case 'feedback':
      return <PanelFeedback />;
    case 'issues':
      return <PanelIssues />;
    case 'featureFlags':
      return <PanelFeatureFlags />;
    default:
      return null;
  }
}
