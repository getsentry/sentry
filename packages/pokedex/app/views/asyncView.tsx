import AsyncComponent from 'sentry/components/asyncComponent';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';

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
    return (
      <SentryDocumentTitle title={this.getTitle()}>
        {this.renderComponent() as React.ReactChild}
      </SentryDocumentTitle>
    );
  }
}
