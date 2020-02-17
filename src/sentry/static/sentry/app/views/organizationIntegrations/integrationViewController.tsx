import React from 'react';

import {isIntegrationDirectoryActive} from 'app/utils/integrationUtil.tsx';

import Test from './integrationListDirectory';
import Control from './index';

export default function IntegrationViewController(props) {
  if (isIntegrationDirectoryActive()) {
    return <Test {...props} />;
  }
  return <Control {...props} />;
}
