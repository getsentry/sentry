import React from 'react';
import {Router, browserHistory} from 'react-router';

import routes from 'app/routes';
import {loadPreferencesState} from 'app/actionCreators/preferences';

export default class Main extends React.Component {
  componentDidMount() {
    loadPreferencesState();
  }

  render() {
    return <Router history={browserHistory}>{routes()}</Router>;
  }
}
