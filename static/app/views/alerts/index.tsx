import {cloneElement, Component, Fragment, isValidElement} from 'react';

import Feature from 'sentry/components/acl/feature';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

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
