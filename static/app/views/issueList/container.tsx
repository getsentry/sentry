import React, {Component} from 'react';
import DocumentTitle from 'react-document-title';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import GlobalSelectionHeader from 'sentry/components/organizations/globalSelectionHeader';
import GroupStore from 'sentry/stores/groupStore';
import {Organization, Project} from 'sentry/types';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import withOrganization from 'sentry/utils/withOrganization';
import SampleEventAlert from 'sentry/views/organizationGroupDetails/sampleEventAlert';

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

  getTitle() {
    return `Issues - ${this.props.organization.slug} - Sentry`;
  }
}
export default withOrganization(IssueListContainer);
export {IssueListContainer};
