import {IndexRoute, Redirect, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export function AutomationRoutes() {
  const root = `/automations/`;
  return (
    <Route path={root} withOrgPath>
      <IndexRoute component={make(() => import('sentry/views/automations/list'))} />
      <Redirect from=":slug/" to={root} />
      <Redirect from=":slug/edit/" to={root} />
      <Route
        path=":projectId/:slug/"
        component={make(() => import('sentry/views/automations/detail'))}
      />
      <Route
        path=":projectId/:slug/edit/"
        component={make(() => import('sentry/views/automations/edit'))}
      />
    </Route>
  );
}
