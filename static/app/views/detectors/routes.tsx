import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export const detectorRoutes = (
  <Route path="/monitors/">
    <IndexRoute component={make(() => import('sentry/views/detectors/list'))} />
    <Route path="new/" component={make(() => import('sentry/views/detectors/new'))} />
    <Route
      path="new/settings/"
      component={make(() => import('sentry/views/detectors/new-settings'))}
    />
    <Route
      path=":monitorId/"
      component={make(() => import('sentry/views/detectors/detail'))}
    />
    <Route
      path=":monitorId/edit/"
      component={make(() => import('sentry/views/detectors/edit'))}
    />
  </Route>
);
