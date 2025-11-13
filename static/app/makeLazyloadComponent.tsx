import {lazy} from 'react';

import LazyLoad from 'sentry/components/lazyLoad';
import {PRELOAD_HANDLE} from 'sentry/router/preload';
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
  // Create a shared promise that both lazy() and preload() will use
  let sharedPromise: Promise<{default: C}> | null = null;
  let loadedComponent: C | null = null;

  const getSharedPromise = () => {
    if (!sharedPromise) {
      sharedPromise = retryableImport(resolve)
        .then(result => {
          loadedComponent = result.default;
          return result;
        })
        .catch(e => {
          sharedPromise = null;
          throw e;
        });
    }
    return sharedPromise;
  };

  const LazyComponent = lazy(getSharedPromise);

  // XXX: Assign the component to a variable so it has a displayname
  function RouteLazyLoad(props: React.ComponentProps<C>) {
    return (
      <SafeLazyLoad
        {...props}
        // If the component is already loaded, render it directly to avoid Suspense
        LazyComponent={loadedComponent ?? LazyComponent}
        loadingFallback={loadingFallback}
      />
    );
  }

  // Add preload method that triggers the same shared promise as lazy()
  RouteLazyLoad[PRELOAD_HANDLE] = getSharedPromise;

  return RouteLazyLoad;
}
