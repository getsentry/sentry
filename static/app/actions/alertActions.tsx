import 'sentry/stores/alertStore';

import Reflux from 'reflux';

const AlertActions = Reflux.createActions(['addAlert', 'closeAlert']);

export default AlertActions;
