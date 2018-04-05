import DocumentTitle from 'react-document-title';
import React from 'react';

import AsyncComponent from '../components/asyncComponent';

export default class AsyncView extends AsyncComponent {
  getTitle() {
    return '';
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      needsVerification: false,
    };
  }

  render() {
    let title = this.getTitle();
    return (
      <DocumentTitle title={`${title ? `${title} - ` : ''}Sentry`}>
        {this.renderComponent()}
      </DocumentTitle>
    );
  }
}
