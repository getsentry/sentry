import {CacheProvider} from '@emotion/core'; // This is needed to set "speedy" = false (for percy)
import {ThemeProvider} from 'emotion-theming';
import {cache} from 'emotion'; // eslint-disable-line emotion/no-vanilla
import React from 'react';
import {Router, browserHistory} from 'react-router';

import GlobalStyles from 'app/styles/global';
import routes from 'app/routes';
import theme from 'app/utils/theme';
import {loadPreferencesState} from 'app/actionCreators/preferences';

class Main extends React.Component {
  componentDidMount() {
    loadPreferencesState();
  }

  render() {
    return (
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <GlobalStyles theme={theme} />
          <Router history={browserHistory}>{routes()}</Router>
        </ThemeProvider>
      </CacheProvider>
    );
  }
}

export default Main;
