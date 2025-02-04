import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export const automationRoutes = (
  <Route path="/automations/" withOrgPath>
    <IndexRoute component={make(() => import('sentry/views/automations/list'))} />
    <Route path="new/" component={make(() => import('sentry/views/automations/new'))} />
    <Route
      path="new/settings/"
      component={make(() => import('sentry/views/automations/new-settings'))}
    />
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
