import Feature from 'sentry/components/acl/feature';
import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export function DetectorRoutes() {
  return (
    <Feature features="workflow-engine-ui">
      <Route path="/monitors/" withOrgPath>
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
    </Feature>
  );
}
