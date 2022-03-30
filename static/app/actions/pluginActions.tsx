import {createActions} from 'reflux';

const PluginActions = createActions([
  'update',
  'updateError',
  'updateSuccess',
  'fetchAll',
  'fetchAllSuccess',
  'fetchAllError',
]);

export default PluginActions;
