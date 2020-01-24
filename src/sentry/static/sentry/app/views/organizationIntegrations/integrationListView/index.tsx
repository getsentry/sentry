import React from 'react';
import Control, {OrganizationIntegrations} from './control';
import Test from './test';

export default function IntegrationListView(props) {
  if (localStorage.getItem('USE_INTEGRATION_DIRECTORY') === '1') {
    return <Test {...props} />;
  }
  return <Control {...props} />;
}

export {OrganizationIntegrations};
