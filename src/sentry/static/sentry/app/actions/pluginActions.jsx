import Reflux from 'reflux';

let PluginActions = Reflux.createActions([
  'update',
  'updateError',
  'updateSuccess',
  'fetchAll',
  'fetchAllSuccess',
  'fetchAllError',
]);

export default PluginActions;
