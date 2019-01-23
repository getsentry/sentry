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
    const hasProjects =
      organization.projects.filter(p => p.isMember && p.hasAccess).length !== 0;

    return (
      <DocumentTitle title={this.getTitle()}>
        <Feature features={['sentry10']} renderDisabled>
          <GlobalSelectionHeader organization={organization} />

          <PageContent>
            {hasProjects ? (
              children
            ) : (
              <NoProjectMessage organization={this.props.organization} />
            )}
          </PageContent>
        </Feature>
      </DocumentTitle>
    );
  }
}
export default withRouter(withOrganization(OrganizationStreamContainer));
export {OrganizationStreamContainer};
