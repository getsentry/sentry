import React from 'react';
import Control, {OrganizationIntegrations} from './index';
import Test from './integrationListDirectory';

export default function IntegrationListView(props) {
  if (localStorage.getItem('USE_INTEGRATION_DIRECTORY') === '1') {
    return <Test {...props} />;
  }
  return <Control {...props} />;
}

export {OrganizationIntegrations};
