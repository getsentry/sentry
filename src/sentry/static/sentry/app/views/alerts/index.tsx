import React from 'react';

import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import Feature from 'app/components/acl/feature';

type Props = {
  organization: Organization;
};

class AlertsContainer extends React.Component<Props> {
  render() {
    const {children, organization} = this.props;
    return (
      <Feature organization={organization} features={['incidents']}>
        {({hasFeature: hasMetricAlerts}) => (
          <React.Fragment>
            {children && React.isValidElement(children)
              ? React.cloneElement(children, {
                  organization,
                  hasMetricAlerts,
                })
              : children}
          </React.Fragment>
        )}
      </Feature>
    );
  }
}

export default withOrganization(AlertsContainer);
