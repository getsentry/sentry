import DocumentTitle from 'react-document-title';
import React from 'react';

import OrganizationHomeContainer from '../components/organizations/homeContainer';
import AsyncView from './asyncView';

class OrganizationSettingsView extends AsyncView {
  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <OrganizationHomeContainer {...this.props}>
          {this.renderComponent()}
        </OrganizationHomeContainer>
      </DocumentTitle>
    );
  }
}

export default OrganizationSettingsView;
