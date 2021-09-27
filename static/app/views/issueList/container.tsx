import {Component} from 'react';
import DocumentTitle from 'react-document-title';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
};

class IssueListContainer extends Component<Props> {
  getTitle() {
    return `Issues - ${this.props.organization.slug} - Sentry`;
  }

  render() {
    const {organization, children} = this.props;

    return (
      <DocumentTitle title={this.getTitle()}>
        <GlobalSelectionHeader>
          <LightWeightNoProjectMessage organization={organization}>
            {children}
          </LightWeightNoProjectMessage>
        </GlobalSelectionHeader>
      </DocumentTitle>
    );
  }
}
export default withOrganization(IssueListContainer);
export {IssueListContainer};
