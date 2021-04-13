import React from 'react';

import Feature from 'app/components/acl/feature';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
};

class AlertsContainer extends React.Component<Props> {
  render() {
    const {children, organization} = this.props;
    return (
      <LightWeightNoProjectMessage organization={organization}>
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
      </LightWeightNoProjectMessage>
    );
  }
}

export default withOrganization(AlertsContainer);
