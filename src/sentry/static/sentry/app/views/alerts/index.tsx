import { isValidElement, cloneElement, Component, Fragment } from 'react';

import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import Feature from 'app/components/acl/feature';

type Props = {
  organization: Organization;
};

class AlertsContainer extends Component<Props> {
  render() {
    const {children, organization} = this.props;
    return (
      <Feature organization={organization} features={['incidents']}>
        {({hasFeature: hasMetricAlerts}) => (
          <Fragment>
            {children && isValidElement(children)
              ? cloneElement(children, {
                  organization,
                  hasMetricAlerts,
                })
              : children}
          </Fragment>
        )}
      </Feature>
    );
  }
}

export default withOrganization(AlertsContainer);
