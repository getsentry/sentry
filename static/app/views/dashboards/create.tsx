import {useState} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {useLocation} from 'sentry/utils/useLocation';

import {EMPTY_DASHBOARD} from './data';
import {DashboardDetailWithInjectedProps as DashboardDetail} from './detail';
import type {DashboardDetails, Widget} from './types';
import {DashboardState} from './types';
import {cloneDashboard} from './utils';

export default function CreateDashboard() {
  const location = useLocation();

  const [dashboard] = useState<DashboardDetails>(() => {
    const base = cloneDashboard(EMPTY_DASHBOARD);
    if (location.state?.widgets?.length) {
      return {...base, widgets: location.state.widgets as Widget[]};
    }
    return base;
  });

  return (
    <ErrorBoundary>
      <DashboardDetail initialState={DashboardState.CREATE} dashboard={dashboard} />
    </ErrorBoundary>
  );
}
