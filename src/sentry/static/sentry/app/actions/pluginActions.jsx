import Reflux from 'reflux';

const PluginActions = Reflux.createActions([
  'update',
  'updateError',
  'updateSuccess',
  'fetchAll',
  'fetchAllSuccess',
  'fetchAllError',
]);

export default PluginActions;
