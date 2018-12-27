import React from 'react';
import {Router, browserHistory} from 'react-router';

import routes from 'app/routes';
import {loadPreferencesState} from 'app/actionCreators/preferences';
import * as tracing from 'app/utils/tracing';

export default class Main extends React.Component {
  componentDidMount() {
    loadPreferencesState();

    tracing.startTransaction();
    this.unlisten = browserHistory.listen(() => tracing.startTransaction());
  }

  componentWillUnmount() {
    if (this.unlisten) {
      this.unlisten();
    }
  }

  render() {
    return <Router history={browserHistory}>{routes()}</Router>;
  }
}
