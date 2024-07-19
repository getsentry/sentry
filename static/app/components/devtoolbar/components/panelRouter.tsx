import {lazy} from 'react';

import useToolbarRoute from '../hooks/useToolbarRoute';

const PanelFeedback = lazy(() => import('./feedback/feedbackPanel'));
const PanelIssues = lazy(() => import('./issues/issuesPanel'));

export default function PanelRouter() {
  const {state} = useToolbarRoute();

  switch (state.activePanel) {
    case 'feedback':
      return <PanelFeedback />;
    case 'issues':
      return <PanelIssues />;
    default:
      return null;
  }
}
