import 'sentry/stores/groupStore';
import 'sentry/stores/groupingStore';
import 'sentry/stores/tagStore';

import Reflux from 'reflux';

const TagActions = Reflux.createActions(['loadTagsError', 'loadTagsSuccess']);

export default TagActions;
