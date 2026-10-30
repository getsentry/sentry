import {lazy, useState} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {PRELOAD_HANDLE} from 'sentry/router/preload';
import {errorHandler} from 'sentry/utils/errorHandler';
import {retryableImport} from 'sentry/utils/retryableImport';

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
    // If the component is already loaded, render it directly to avoid Suspense.
    // The choice is pinned for the lifetime of this mount: switching from
    // LazyComponent to loadedComponent on a later render changes the element
    // type, which makes React remount the whole route and drop its state.
    const [Component] = useState(() => loadedComponent ?? LazyComponent);

    return (
      <SafeLazyLoad
        {...props}
        LazyComponent={Component}
        loadingFallback={loadingFallback}
      />
    );
  }

  // Add preload method that triggers the same shared promise as lazy()
  RouteLazyLoad[PRELOAD_HANDLE] = getSharedPromise;

  return RouteLazyLoad;
}
