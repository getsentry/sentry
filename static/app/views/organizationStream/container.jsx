import {withRouter} from 'react-router';
import React from 'react';
import DocumentTitle from 'react-document-title';

import {PageContent} from 'app/styles/organization';
import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class OrganizationStreamContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  getTitle() {
    return `Issues - ${this.props.organization.slug} - Sentry`;
  }

  render() {
    const {organization, children} = this.props;

    return (
      <DocumentTitle title={this.getTitle()}>
        <Feature features={['sentry10']} renderDisabled>
          <GlobalSelectionHeader organization={organization} />

          <PageContent>
            <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
          </PageContent>
        </Feature>
      </DocumentTitle>
    );
  }
}
export default withRouter(withOrganization(OrganizationStreamContainer));
export {OrganizationStreamContainer};
