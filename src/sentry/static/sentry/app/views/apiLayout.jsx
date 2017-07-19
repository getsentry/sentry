import React from 'react';

import ListLink from '../components/listLink';
import NarrowLayout from '../components/narrowLayout';
import {t} from '../locale';

const ApiDashboard = React.createClass({
  render() {
    return (
      <NarrowLayout>
        <h3>{t('Sentry Web API')}</h3>
        <ul className="nav nav-tabs border-bottom">
          <ListLink to="/api/" index={true}>{t('Auth Tokens')}</ListLink>
          <ListLink to="/api/applications/">{t('Applications')}</ListLink>
        </ul>
        {this.props.children}
      </NarrowLayout>
    );
  }
});

export default ApiDashboard;
