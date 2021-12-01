import {Component} from 'react';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

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
