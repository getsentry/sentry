import Feature from 'sentry/components/acl/feature';
import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/routes';

export function AutomationRoutes() {
  const root = `/issues/automations/`;
  return (
    <Feature features="workflow-engine-ui">
      <Route path={root} withOrgPath>
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
    </Feature>
  );
}
