import React from 'react';
import Control from './index';
import Test from './integrationListDirectory';

export default function IntegrationViewController(props) {
  if (localStorage.getItem('USE_INTEGRATION_DIRECTORY') === '1') {
    return <Test {...props} />;
  }
  return <Control {...props} />;
}
