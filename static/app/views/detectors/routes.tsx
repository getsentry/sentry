import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export const detectorRoutes = (
  <Route path="/monitors/">
    <IndexRoute component={make(() => import('sentry/views/detectors/list'))} />
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
