import 'sentry/stores/organizationEnvironmentsStore';

import Reflux from 'reflux';

const EnvironmentActions = Reflux.createActions([
  'fetchEnvironments',
  'fetchEnvironmentsError',
  'fetchEnvironmentsSuccess',
]);

export default EnvironmentActions;
