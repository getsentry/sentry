import React from 'react';

import {isIntegrationDirectoryActive} from 'app/utils/integrationUtil.tsx';

import Control from './index';
import Test from './integrationListDirectory';

export default function IntegrationViewController(props) {
  if (isIntegrationDirectoryActive()) {
    return <Test {...props} />;
  }
  return <Control {...props} />;
}
