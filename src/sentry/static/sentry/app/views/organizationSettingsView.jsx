import DocumentTitle from 'react-document-title';
import React from 'react';

import AsyncView from './asyncView';

class OrganizationSettingsView extends AsyncView {
  render() {
    return (
      <DocumentTitle title={this.getTitle()}>{this.renderComponent()}</DocumentTitle>
    );
  }
}

export default OrganizationSettingsView;
