import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {isIntegrationDirectoryActive} from 'app/utils/integrationUtil.tsx';
import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';
import {logExperiment} from 'app/utils/analytics';

import Control from './index';
import Test from './integrationListDirectory';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  hideHeader: boolean;
};

class IntegrationViewController extends React.Component<Props> {
  componentDidMount() {
    logExperiment({
      organization: this.props.organization,
      key: 'IntegrationsDirectoryExperiment',
      unitName: 'org_id',
      unitId: parseInt(this.props.organization.id, 10),
      param: 'variant',
    });
  }

  render() {
    if (isIntegrationDirectoryActive(this.props.organization)) {
      return <Test {...this.props} />;
    }
    return <Control {...this.props} />;
  }
}

export default withOrganization(IntegrationViewController);
