import Reflux from 'reflux';

let EnvironmentActions = Reflux.createActions([
  'setActive',
  'clearActive',
  'loadData',
  'loadActiveData',
  'loadHiddenData',
  'setDefault',
]);

export default EnvironmentActions;
