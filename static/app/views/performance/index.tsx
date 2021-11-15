import {Component} from 'react';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import {MetricsSwitchContextContainer} from './metricsSwitch';

type Props = {
  organization: Organization;
};

class PerformanceContainer extends Component<Props> {
  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
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
        <MetricsSwitchContextContainer>{children}</MetricsSwitchContextContainer>
      </Feature>
    );
  }
}

export default withOrganization(PerformanceContainer);
