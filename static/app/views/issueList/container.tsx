import React, {Component} from 'react';
import DocumentTitle from 'react-document-title';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import SampleEventAlert from 'app/views/organizationGroupDetails/sampleEventAlert';

type Props = {
  organization: Organization;
  projects: Project[];
};

class IssueListContainer extends Component<Props> {
  getTitle() {
    return `Issues - ${this.props.organization.slug} - Sentry`;
  }

  render() {
    const {organization, children} = this.props;
    return (
      <DocumentTitle title={this.getTitle()}>
        <React.Fragment>
          <SampleEventAlert />
          <GlobalSelectionHeader>
            <LightWeightNoProjectMessage organization={organization}>
              {children}
            </LightWeightNoProjectMessage>
          </GlobalSelectionHeader>
        </React.Fragment>
      </DocumentTitle>
    );
  }
}
export default withOrganization(IssueListContainer);
export {IssueListContainer};
