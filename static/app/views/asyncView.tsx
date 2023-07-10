import DeprecatedAsyncComponent from 'sentry/components/asyncComponent';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';

export type AsyncViewState = DeprecatedAsyncComponent['state'];
export type AsyncViewProps = DeprecatedAsyncComponent['props'];

export default class AsyncView<
  P extends AsyncViewProps = AsyncViewProps,
  S extends AsyncViewState = AsyncViewState
> extends DeprecatedAsyncComponent<P, S> {
  getTitle() {
    return '';
  }

  render() {
    return (
      <SentryDocumentTitle title={this.getTitle()}>
        {this.renderComponent() as React.ReactChild}
      </SentryDocumentTitle>
    );
  }
}
