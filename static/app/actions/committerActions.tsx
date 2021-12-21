import 'sentry/stores/committerStore';

import Reflux from 'reflux';

const ComitterActions = Reflux.createActions([
  'reset',
  'load',
  'loadError',
  'loadSuccess',
]);

export default ComitterActions;
