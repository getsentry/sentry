import React from 'react';
import * as Router from 'react-router';
import routes from './routes';

export default class App extends React.Component {
  render() {
    return (
      <Router.Router history={Router.browserHistory}>
        {routes()}
      </Router.Router>
    );
  }
}
