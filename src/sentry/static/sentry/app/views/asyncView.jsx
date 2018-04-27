import DocumentTitle from 'react-document-title';
import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';

export default class AsyncView extends AsyncComponent {
  getTitle() {
    return '';
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
