import {Fragment, type ReactNode, Suspense, useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Flex} from 'sentry/components/container/flex';
import ObjectInspector from 'sentry/components/objectInspector';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';
import {useQueryClient, type UseQueryOptions} from 'sentry/utils/queryClient';

/**
 * Fake endpoint to simulate loading data with 5 second delay
 */
function fetchData() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({some: 'data'});
    }, 5_000);
  });
}

function fetchThrowsError() {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject('An error happened');
    }, 5_000);
  });
}

/**
 * Helper react component to track how long something has been rendered
 */
function LoadingFallback() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds(prev => prev + 1), 1_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      Loading...
      <p>Rendered for {seconds} seconds</p>
    </div>
  );
}

function ToggleMounted({
  children,
  queryKeys,
}: {
  children: ReactNode;
  queryKeys: Array<readonly unknown[]>;
}) {
  const [isMounted, setIsMounted] = useState(true);
  const queryClient = useQueryClient();

  return (
    <Fragment>
      <Flex align="flex-start" column gap={space(1)}>
        <ButtonBar merged>
          <Button size="sm" onClick={() => setIsMounted(prev => !prev)}>
            {isMounted ? 'Unmount' : 'Mount'}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              queryKeys.forEach(queryKey =>
                queryClient.resetQueries({queryKey, exact: true})
              )
            }
          >
            Reset Queries
          </Button>
        </ButtonBar>
        <SizingWindow>{isMounted ? children : null}</SizingWindow>
      </Flex>
    </Fragment>
  );
}

function DataContainer({
  children,
  options,
}: {
  options: UseQueryOptions;
  children?: ReactNode;
}) {
  const {
    data,
    error,
    isError,
    isFetching,
    isInitialLoading,
    isLoading,
    isSuccess,
    refetch,
    status,
  } = useQuery(options);

  return (
    <Flex column gap={space(1)}>
      {children}
      <Button size="xs" onClick={() => refetch()}>
        refetch
      </Button>
      <ObjectInspector
        data={{
          status,
          isFetching,
          isLoading,
          isInitialLoading,
          isError,
          error,
          isSuccess,
          data,
        }}
        expandLevel={2}
      />
    </Flex>
  );
}

export default storyBook('useQuery', story => {
  story('README', () => (
    <Fragment>
      <p>
        This is a set of examples for how to call <code>useQuery()</code> and make the
        most of it's built-in fetching/loading/error/success states.
      </p>
      <p>
        These examples import from <code>@tanstack/react-query</code> directly, instead of
        from <code>sentry/utils/queryClient</code> in order to directly test the api
        without sentry specific helpers getting in the way. What's being tested are the
        return types, which are consistent between <code>sentry/utils/queryClient</code>{' '}
        and <code>@tanstack/react-query</code>.
      </p>
      <p>
        You should prefer to import from <code>sentry/utils/queryClient</code> as much as
        possible to benefit from easier and consistent data fetching within sentry.
      </p>
    </Fragment>
  ));
  story('TL/DR', () => (
    <Fragment>
      <p>
        It seems like you can get really far by checking BOTH{' '}
        <code>isFetching || isLoading</code> when you are waiting for the first render,
        particularly when using <code>enabled</code> but not setting{' '}
        <code>initialData</code> (which is a common situation).
      </p>
      <p>
        Also using <code>suspense</code> is a pattern that we should adopt more because it
        simplifies a lot of state coalescing, especially when multiple fetches are
        happening concurrently.
      </p>
    </Fragment>
  ));

  story('Basic', () => {
    return (
      <ToggleMounted queryKeys={[['story-basic-success'], ['story-basic-error']]}>
        <SideBySide>
          <DataContainer
            options={{
              queryKey: ['story-basic-success'],
              queryFn: fetchData,
            }}
          >
            <div>status begins as "loading"</div>
          </DataContainer>
          <DataContainer
            options={{
              queryKey: ['story-basic-error'],
              queryFn: fetchThrowsError,
              retry: 0,
            }}
          >
            <div>expected to throw an error</div>
          </DataContainer>
        </SideBySide>
      </ToggleMounted>
    );
  });

  story('enabled: false', () => {
    return (
      <ToggleMounted queryKeys={[['story-disabled-success'], ['story-disabled-error']]}>
        <SideBySide>
          <DataContainer
            options={{
              queryKey: ['story-disabled-success'],
              queryFn: fetchData,
              enabled: false,
            }}
          >
            <div>
              manual refetch ignores <code>enabled: false</code>
            </div>
          </DataContainer>
          <DataContainer
            options={{
              queryKey: ['story-disabled-error'],
              queryFn: fetchThrowsError,
              retry: 0,
              enabled: false,
            }}
          >
            <div>
              manual refetch ignores <code>enabled: false</code>
            </div>
          </DataContainer>
        </SideBySide>
      </ToggleMounted>
    );
  });

  story('initialData: {...}', () => {
    return (
      <ToggleMounted
        queryKeys={[['story-initialData-success'], ['story-initialData-error']]}
      >
        <SideBySide>
          <DataContainer
            options={{
              queryKey: ['story-initialData-success'],
              queryFn: fetchData,
              initialData: {tmp: 'data'},
            }}
          >
            <div>status begins as "success"</div>
          </DataContainer>
          <DataContainer
            options={{
              queryKey: ['story-initialData-error'],
              queryFn: fetchThrowsError,
              retry: 0,
              initialData: {tmp: 'data'},
            }}
          >
            <div>expected to throw an error</div>
          </DataContainer>
        </SideBySide>
      </ToggleMounted>
    );
  });

  story('enabled:false, initialData: {...}', () => {
    return (
      <ToggleMounted
        queryKeys={[['story-initialData-success'], ['story-initialData-error']]}
      >
        <SideBySide>
          <DataContainer
            options={{
              queryKey: ['story-initialData-success'],
              queryFn: fetchData,
              enabled: false,
              initialData: {tmp: 'data'},
            }}
          >
            <div>status begins as "success"</div>
          </DataContainer>
          <DataContainer
            options={{
              queryKey: ['story-initialData-error'],
              queryFn: fetchThrowsError,
              retry: 0,
              enabled: false,
              initialData: {tmp: 'data'},
            }}
          >
            <div>expected to throw an error</div>
          </DataContainer>
        </SideBySide>
      </ToggleMounted>
    );
  });

  story('suspense: true, useErrorBoundary: false', () => {
    return (
      <ToggleMounted queryKeys={[['story-suspense-success'], ['story-suspense-error']]}>
        <Suspense fallback={<LoadingFallback />}>
          <DataContainer
            options={{
              queryKey: ['story-suspense-success'],
              queryFn: fetchData,
              suspense: true,
              useErrorBoundary: false,
            }}
          />
        </Suspense>
        <Suspense fallback={<LoadingFallback />}>
          <DataContainer
            options={{
              queryKey: ['story-suspense-error'],
              queryFn: fetchThrowsError,
              retry: 0,
              suspense: true,
              useErrorBoundary: false,
            }}
          />
        </Suspense>
      </ToggleMounted>
    );
  });

  story('useErrorBoundary: true', () => {
    return (
      <p>
        TODO: I was unable to get an example to work with react-query v4 and react 18.2.0
      </p>
    );
  });
});
