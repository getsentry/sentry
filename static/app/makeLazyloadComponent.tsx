import {lazy} from 'react';

import LazyLoad from 'sentry/components/lazyLoad';
import errorHandler from 'sentry/utils/errorHandler';
import retryableImport from 'sentry/utils/retryableImport';

// LazyExoticComponent Props get crazy when wrapped in an additional layer
const SafeLazyLoad = errorHandler(LazyLoad) as unknown as React.ComponentType<
  typeof LazyLoad
>;

/**
 * Factory function to produce a component that will render the SafeLazyLoad
 * _with_ the required props.
 */
export function makeLazyloadComponent<C extends React.ComponentType<any>>(
  resolve: () => Promise<{default: C}>,
  loadingFallback?: React.ReactNode
) {
  const LazyComponent = lazy<C>(() => retryableImport(resolve));
  // XXX: Assign the component to a variable so it has a displayname
  function RouteLazyLoad(props: React.ComponentProps<C>) {
    // we can use this hook to set the organization as it's
    // a child of the organization context
    return (
      <SafeLazyLoad
        {...props}
        LazyComponent={LazyComponent}
        loadingFallback={loadingFallback}
      />
    );
  }

  return RouteLazyLoad;
}
