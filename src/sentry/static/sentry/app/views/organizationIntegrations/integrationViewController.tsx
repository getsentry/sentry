import React from 'react';
import {isIntegrationDirectoryActive} from 'app/utils/integrationUtil.tsx';
import withOrganization from 'app/utils/withOrganization';
import {RouteComponentProps} from 'react-router/lib/Router';
import {Organization} from 'app/types';

import Control from './index';
import Test from './integrationListDirectory';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  hideHeader: boolean;
};

function IntegrationViewController(props: Props) {
  if (
    isIntegrationDirectoryActive(
      props.organization?.experiments?.IntegrationDirectoryExperiment
    )
  ) {
    return <Test {...props} />;
  }
  return <Control {...props} />;
}

export default withOrganization(IntegrationViewController);
