import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export const detectorRoutes = (
  <Route path="monitors/">
    <IndexRoute component={make(() => import('sentry/views/detectors/list'))} />
    <Route path="new">
      <IndexRoute component={make(() => import('sentry/views/detectors/new'))} />
      <Route
        path="settings/"
        component={make(() => import('sentry/views/detectors/new-settings'))}
      />
    </Route>
    <Route path=":monitorId/">
      <IndexRoute component={make(() => import('sentry/views/detectors/detail'))} />
      <Route path="edit/" component={make(() => import('sentry/views/detectors/edit'))} />
    </Route>
  </Route>
);

export const MONITORS_BASE_URL = '/issues/monitors';
