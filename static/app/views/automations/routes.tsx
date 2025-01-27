import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export const automationRoutes = (
  <Route path="/automations/" withOrgPath>
    <IndexRoute component={make(() => import('sentry/views/automations/list'))} />
    <Route
      path=":automationId/"
      component={make(() => import('sentry/views/automations/detail'))}
    />
    <Route
      path=":automationId/edit/"
      component={make(() => import('sentry/views/automations/edit'))}
    />
  </Route>
);
