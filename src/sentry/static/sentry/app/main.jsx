/* global module */
import React from 'react';
import {hot} from 'react-hot-loader';
import {Router, browserHistory} from 'react-router';

import routes from 'app/routes';
import {loadPreferencesState} from 'app/actionCreators/preferences';
import * as tracing from 'app/utils/tracing';

function updateTracingData () {
  tracing.setTransactionId()
  tracing.setSpanId()
  tracing.setCurrentRoute(browserHistory.getCurrentLocation().pathname)
}

class Main extends React.Component {
  componentDidMount() {
    loadPreferencesState();
    updateTracingData();
    tracing.start();
    // Listen for route changes so we can set transaction data
    this.unlistenBrowserHistory = browserHistory.listen(() => updateTracingData());
  }

  componentWillUnmount() {
    if (this.unlistenBrowserHistory) {
      this.unlistenBrowserHistory();
    }
  }

  render() {
    return <Router history={browserHistory}>{routes()}</Router>;
  }
}

export default hot(module)(Main);
