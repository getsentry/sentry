import DocumentTitle from 'react-document-title';
import React from 'react';

import AsyncComponent from '../components/asyncComponent';

class AsyncView extends AsyncComponent {
  constructor(...args) {
    super(...args);
  }

  getTitle() {
    return 'Sentry';
  }
  render() {
    return (
      <DocumentTitle title={this.getTitle()}>{this.renderComponent()}</DocumentTitle>
    );
  }
}

export default AsyncView;
