import {IndexRoute, Redirect, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export function DetectorRoutes() {
  const root = `/monitors/`;
  return (
    <Route path={root} withOrgPath>
      <IndexRoute component={make(() => import('sentry/views/detectors/list'))} />
      <Redirect from=":slug/" to={root} />
      <Redirect from=":slug/edit/" to={root} />
      <Route
        path=":projectId/:slug/"
        component={make(() => import('sentry/views/detectors/detail'))}
      />
      <Route
        path=":projectId/:slug/edit/"
        component={make(() => import('sentry/views/detectors/edit'))}
      />
    </Route>
  );
}
