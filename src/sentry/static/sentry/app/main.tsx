import React from 'react';
import {browserHistory, Router} from 'react-router';

import routes from 'app/routes';

import ThemeAndStyleProvider from './themeAndStyleProvider';

export default function Main() {
  return (
    <ThemeAndStyleProvider>
      <Router history={browserHistory}>{routes()}</Router>
    </ThemeAndStyleProvider>
  );
}
