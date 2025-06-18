import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

export const automationRoutes = (
  <Route path="automations/">
    <IndexRoute component={make(() => import('sentry/views/automations/list'))} />
    <Route path="new">
      <IndexRoute component={make(() => import('sentry/views/automations/new'))} />
      <Route
        path="settings/"
        component={make(() => import('sentry/views/automations/new-settings'))}
      />
    </Route>
    <Route path=":automationId/">
      <IndexRoute component={make(() => import('sentry/views/automations/detail'))} />
      <Route
        path="edit/"
        component={make(() => import('sentry/views/automations/edit'))}
      />
    </Route>
  </Route>
);
