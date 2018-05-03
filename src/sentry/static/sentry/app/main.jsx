import React from 'react';
import {Router, browserHistory} from 'react-router';

import routes from 'app/routes';
import {loadSidebarState} from 'app/actionCreators/sidebar';

export default class Main extends React.Component {
  componentDidMount() {
    loadSidebarState();
  }

  render() {
    return <Router history={browserHistory}>{routes()}</Router>;
  }
}
