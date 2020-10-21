import DocumentTitle from 'react-document-title';

import AsyncComponent from 'app/components/asyncComponent';

type AsyncViewState = AsyncComponent['state'];
type AsyncViewProps = AsyncComponent['props'];

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
