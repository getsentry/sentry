import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';

type AsyncViewState = DeprecatedAsyncComponent['state'];
type AsyncViewProps = DeprecatedAsyncComponent['props'];

/**
 * @deprecated use useApiQuery instead.
 *
 * Read the dev docs page on network requests for more information [1].
 *
 * [1]: https://develop.sentry.dev/frontend/network-requests/
 */
export default abstract class DeprecatedAsyncView<
  P extends AsyncViewProps = AsyncViewProps,
  S extends AsyncViewState = AsyncViewState,
> extends DeprecatedAsyncComponent<P, S> {
  abstract getTitle(): string;

  render() {
    return (
      <SentryDocumentTitle title={this.getTitle()}>
        {this.renderComponent()}
      </SentryDocumentTitle>
    );
  }
}
