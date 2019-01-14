import {withRouter} from 'react-router';
import React from 'react';

import {PageContent, PageHeader} from 'app/styles/organization';
import {t} from 'app/locale';
import BetaTag from 'app/components/betaTag';
import Feature from 'app/components/acl/feature';
import PageHeading from 'app/components/pageHeading';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class OrganizationDashboardContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization, children} = this.props;

    return (
      <Feature features={['sentry10']} renderDisabled>
        <GlobalSelectionHeader organization={organization} />

        <PageContent>
          <PageHeader>
            <PageHeading withMargins>
              {t('Dashboard')} <BetaTag />
            </PageHeading>
          </PageHeader>

          {children}
        </PageContent>
      </Feature>
    );
  }
}
export default withRouter(withOrganization(OrganizationDashboardContainer));
export {OrganizationDashboardContainer};
