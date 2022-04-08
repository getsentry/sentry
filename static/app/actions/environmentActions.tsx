import {createActions} from 'reflux';

const EnvironmentActions = createActions([
  'fetchEnvironments',
  'fetchEnvironmentsError',
  'fetchEnvironmentsSuccess',
]);

export default EnvironmentActions;
