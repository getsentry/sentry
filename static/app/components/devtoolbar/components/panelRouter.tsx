import {lazy} from 'react';

import AnalyticsProvider from 'sentry/components/devtoolbar/components/analyticsProvider';

import useToolbarRoute from '../hooks/useToolbarRoute';

const PanelAlerts = lazy(() => import('./alerts/alertsPanel'));
const PanelFeedback = lazy(() => import('./feedback/feedbackPanel'));
const PanelIssues = lazy(() => import('./issues/issuesPanel'));
const PanelFeatureFlags = lazy(() => import('./featureFlags/featureFlagsPanel'));
const PanelReleases = lazy(() => import('./releases/releasesPanel'));
const PanelReplay = lazy(() => import('./replay/replayPanel'));

export default function PanelRouter() {
  const {state} = useToolbarRoute();

  switch (state.activePanel) {
    case 'alerts':
      return (
        <AnalyticsProvider keyVal="alerts-panel" nameVal="Alerts panel">
          <PanelAlerts />
        </AnalyticsProvider>
      );
    case 'feedback':
      return (
        <AnalyticsProvider keyVal="feedback-panel" nameVal="Feedback panel">
          <PanelFeedback />
        </AnalyticsProvider>
      );
    case 'issues':
      return (
        <AnalyticsProvider keyVal="issues-panel" nameVal="Issues panel">
          <PanelIssues />
        </AnalyticsProvider>
      );
    case 'featureFlags':
      return (
        <AnalyticsProvider keyVal="feature-flags-panel" nameVal="Feature Flags panel">
          <PanelFeatureFlags />
        </AnalyticsProvider>
      );
    case 'releases':
      return (
        <AnalyticsProvider keyVal="releases-panel" nameVal="Releases panel">
          <PanelReleases />
        </AnalyticsProvider>
      );
    case 'replay':
      return (
        <AnalyticsProvider keyVal="replay-panel" nameVal="Replay panel">
          <PanelReplay />
        </AnalyticsProvider>
      );
    default:
      return null;
  }
}
