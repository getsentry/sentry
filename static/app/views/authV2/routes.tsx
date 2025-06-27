import {IndexRoute, Route} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

export const authV2Routes = (
  <Route path="auth-v2/">
    <IndexRoute component={make(() => import('sentry/views/authV2/pages/index'))} />
  </Route>
);
