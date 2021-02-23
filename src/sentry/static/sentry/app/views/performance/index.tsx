import React from 'react';

import ComingSoon from 'app/components/acl/comingSoon';
import Feature from 'app/components/acl/feature';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
};

class PerformanceContainer extends React.Component<Props> {
  renderNoAccess() {
    return (
      <PageContent>
        <ComingSoon />
      </PageContent>
    );
  }

  render() {
    const {organization, children} = this.props;

    return (
      <Feature
        hookName="feature-disabled:performance-page"
        features={['performance-view']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        {children}
      </Feature>
    );
  }
}

export default withOrganization(PerformanceContainer);
