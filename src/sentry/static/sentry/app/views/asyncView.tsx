import DocumentTitle from 'react-document-title';
import React from 'react';

import AsyncComponent, {
  AsyncComponentProps,
  AsyncComponentState,
} from 'app/components/asyncComponent';

export type AsyncViewState = AsyncComponentState;
export type AsyncViewProps = AsyncComponentProps;

export default class AsyncView<
  P extends AsyncViewProps = AsyncViewProps,
  S extends AsyncViewState = AsyncViewState
> extends AsyncComponent<P, S> {
  getTitle() {
    return '';
  }

  render() {
    const title = this.getTitle();
    return (
      <DocumentTitle title={`${title ? `${title} - ` : ''}Sentry`}>
        {this.renderComponent()}
      </DocumentTitle>
    );
  }
}
