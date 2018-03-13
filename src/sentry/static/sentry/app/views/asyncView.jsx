import DocumentTitle from 'react-document-title';
import React from 'react';

import AsyncComponent from '../components/asyncComponent';

class AsyncView extends AsyncComponent {
  constructor(...args) {
    super(...args);
  }

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

export default AsyncView;
