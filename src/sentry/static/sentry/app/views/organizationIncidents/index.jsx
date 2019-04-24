import React from 'react';
import DocumentTitle from 'react-document-title';

import SentryTypes from 'app/sentryTypes';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import withOrganization from 'app/utils/withOrganization';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import BetaTag from 'app/components/betaTag';

class OrganizationIncidentsContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  renderNoAccess() {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  render() {
    const {organization, children} = this.props;

    return (
      <DocumentTitle title={`Incidents - ${organization.slug} - Sentry`}>
        <PageContent>
          <Feature
            features={['organizations:incidents']}
            organization={organization}
            renderDisabled={this.renderNoAccess}
          >
            <PageHeader>
              <PageHeading withMargins>
                {t('Incidents')} <BetaTag />
              </PageHeading>
            </PageHeader>
            {children}
          </Feature>
        </PageContent>
      </DocumentTitle>
    );
  }
}

export default withOrganization(OrganizationIncidentsContainer);
