import {hot} from 'react-hot-loader/root'; // This needs to come before react

import {CacheProvider} from '@emotion/core'; // This is needed to set "speedy" = false (for percy)
import {cache} from 'emotion'; // eslint-disable-line emotion/no-vanilla

import React from 'react';
import {Router, browserHistory} from 'react-router';

import routes from 'app/routes';
import {loadPreferencesState} from 'app/actionCreators/preferences';

class Main extends React.Component {
  componentDidMount() {
    loadPreferencesState();
  }

  render() {
    return (
      <CacheProvider value={cache}>
        <Router history={browserHistory}>{routes()}</Router>
      </CacheProvider>
    );
  }
}

export default hot(Main);
