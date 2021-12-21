import 'sentry/stores/preferencesStore';

import Reflux from 'reflux';

const PreferencesActions = Reflux.createActions([
  'loadInitialState',
  'hideSidebar',
  'showSidebar',
]);

export default PreferencesActions;
