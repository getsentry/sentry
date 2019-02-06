import Reflux from 'reflux';

const EnvironmentActions = Reflux.createActions([
  'setActive',
  'clearActive',
  'loadData',
  'loadActiveData',
  'loadHiddenData',
]);

export default EnvironmentActions;
