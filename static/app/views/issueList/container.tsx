import React, {Component} from 'react';
import DocumentTitle from 'react-document-title';

import NoProjectMessage from 'app/components/noProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import GroupStore from 'app/stores/groupStore';
import {Organization, Project} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';
import withOrganization from 'app/utils/withOrganization';
import SampleEventAlert from 'app/views/organizationGroupDetails/sampleEventAlert';

type Props = {
  organization: Organization;
  projects: Project[];
};

type State = {
  showSampleEventBanner: boolean;
};
class IssueListContainer extends Component<Props, State> {
  state: State = {
    showSampleEventBanner: false,
  };

  getTitle() {
    return `Issues - ${this.props.organization.slug} - Sentry`;
  }

  listener = GroupStore.listen(() => this.onGroupChange(), undefined);
  render() {
    const {organization, children} = this.props;
    return (
      <DocumentTitle title={this.getTitle()}>
        <React.Fragment>
          {this.state.showSampleEventBanner && <SampleEventAlert />}
          <GlobalSelectionHeader>
            <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
          </GlobalSelectionHeader>
        </React.Fragment>
      </DocumentTitle>
    );
  }

  onGroupChange() {
    this.setState({
      showSampleEventBanner: GroupStore.getAllItemIds().length === 1,
    });
  }

  componentWillUnmount() {
    callIfFunction(this.listener);
  }
}
export default withOrganization(IssueListContainer);
export {IssueListContainer};
