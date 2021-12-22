import Reflux from 'reflux';

const EnvironmentActions = Reflux.createActions([
  'fetchEnvironments',
  'fetchEnvironmentsError',
  'fetchEnvironmentsSuccess',
]);

export default EnvironmentActions;
