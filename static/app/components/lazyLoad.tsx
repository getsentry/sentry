import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {isWebpackChunkLoadingError} from 'sentry/utils';
import retryableImport from 'sentry/utils/retryableImport';

type PromisedImport<C> = Promise<{default: C}>;

type ComponentType = React.ComponentType<any>;

type Props<C extends ComponentType> = Omit<React.ComponentProps<C>, 'component'> & {
  /**
   * Accepts a function to trigger the import resolution of the component.
   */
  component?: () => PromisedImport<C>;
};

/**
 * LazyLoad is used to dynamically load codesplit components via a `import`
 * call. This is primarily used in our routing tree
 *
 * <LazyLoad component={() => import('./myComponent')} someComponentProps={...} />
 */
function LazyLoad<C extends ComponentType>(props: Props<C>) {
  const [LazyComponent, setLazyComponent] = useState<C | null>(null);
  const [error, setError] = useState<any>(null);

  const handleFetchError = useCallback(
    (fetchError: any) => {
      Sentry.withScope(scope => {
        if (isWebpackChunkLoadingError(fetchError)) {
          scope.setFingerprint(['webpack', 'error loading chunk']);
        }
        Sentry.captureException(fetchError);
      });

      // eslint-disable-next-line no-console
      console.error(fetchError);
      setError(fetchError);
    },
    [setError]
  );

  const importComponent = props.component;

  const fetchComponent = useCallback(async () => {
    if (importComponent === undefined) {
      return;
    }

    // If we're refetching due to a change to importComponent we want to make
    // sure the current LazyComponent is cleared out.
    setLazyComponent(null);

    try {
      const resolvedComponent = await retryableImport(importComponent);

      // XXX: Because the resolvedComponent may be a functional component (a
      // function) trying to pass it into the setLazyComponent will cause the
      // useState to try and execute the function (because useState provides a
      // "functional updates" invocation, see [0]) which is NOT what we want.
      // So we use a functional update invocation to set the component.
      //
      // [0]: https://reactjs.org/docs/hooks-reference.html#functional-updates
      setLazyComponent(() => resolvedComponent);
    } catch (err) {
      handleFetchError(err);
    }
  }, [importComponent, handleFetchError]);

  // Fetch the component on mount and if the importComponent is updated
  useEffect(() => void fetchComponent(), [fetchComponent]);

  const fetchRetry = useCallback(() => {
    setError(null);
    fetchComponent();
  }, [setError, fetchComponent]);

  if (error) {
    return (
      <LoadingErrorContainer>
        <LoadingError
          onRetry={fetchRetry}
          message={t('There was an error loading a component.')}
        />
      </LoadingErrorContainer>
    );
  }

  if (!LazyComponent) {
    return (
      <LoadingContainer>
        <LoadingIndicator />
      </LoadingContainer>
    );
  }

  if (LazyComponent === null) {
    return null;
  }

  return <LazyComponent {...(props as React.ComponentProps<C>)} />;
}

const LoadingContainer = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
`;

const LoadingErrorContainer = styled('div')`
  flex: 1;
`;

export default LazyLoad;
