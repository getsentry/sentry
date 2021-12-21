import 'sentry/stores/organizationsStore';
import 'sentry/stores/latestContextStore';
import 'sentry/stores/guideStore';

import Reflux from 'reflux';

const OrganizationsActions = Reflux.createActions([
  'update',
  'setActive',
  'changeSlug',
  'remove',
  'removeSuccess',
  'removeError',
]);

export default OrganizationsActions;
