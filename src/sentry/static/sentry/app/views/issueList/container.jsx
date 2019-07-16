import React from 'react';
import DocumentTitle from 'react-document-title';

import {PageContent} from 'app/styles/organization';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class IssueListContainer extends React.Component {
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
        <React.Fragment>
          <GlobalSelectionHeader organization={organization} />

          <PageContent>
            <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
          </PageContent>
        </React.Fragment>
      </DocumentTitle>
    );
  }
}
export default withOrganization(IssueListContainer);
export {IssueListContainer};
