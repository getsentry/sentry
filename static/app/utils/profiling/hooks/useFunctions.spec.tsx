import {ReactElement, useMemo} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

const project = TestStubs.Project();

const selection: PageFilters = {
  datetime: {
    period: '14d',
    utc: null,
    start: null,
    end: null,
  },
  environments: [],
  projects: [],
};

const TestContext = ({children}: {children: ReactElement}) => {
  const {organization} = useMemo(() => initializeOrg(), []);
  // ensure client is rebuilt on each render otherwise caching will interfere with subsequent tests
  const client = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={client}>
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
};

describe('useFunctions', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('initializes with the loading state', function () {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/profiling/functions/`,
      body: {functions: []},
    });
    const hook = reactHooks.renderHook(
      () =>
        useFunctions({
          project,
          query: '',
          selection,
          transaction: '',
          sort: '-p99',
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isInitialLoading: true,
      })
    );
  });

  it('fetches functions', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/profiling/functions/`,
      body: {functions: []},
    });

    const hook = reactHooks.renderHook(
      () =>
        useFunctions({
          project,
          query: '',
          transaction: '',
          selection,
          sort: '-p99',
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current.isLoading).toEqual(true);
    expect(hook.result.current.isFetched).toEqual(false);
    await hook.waitForNextUpdate();
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isLoading: false,
        isFetched: true,
        data: expect.arrayContaining([
          {
            functions: expect.any(Array),
          },
        ]),
      })
    );
  });

  it('fetches application functions', async function () {
    const mock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/profiling/functions/`,
      body: {functions: []},
      match: [MockApiClient.matchQuery({is_application: '1'})],
    });

    const hook = reactHooks.renderHook(
      () =>
        useFunctions({
          functionType: 'application',
          project,
          query: '',
          transaction: '',
          selection,
          sort: '-p99',
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current.isLoading).toEqual(true);
    await hook.waitForNextUpdate();
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isLoading: false,
        isFetched: true,
        data: expect.arrayContaining([
          {
            functions: expect.any(Array),
          },
        ]),
      })
    );

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('fetches system functions', async function () {
    const mock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/profiling/functions/`,
      body: {functions: []},
      match: [MockApiClient.matchQuery({is_application: '0'})],
    });

    const hook = reactHooks.renderHook(
      () =>
        useFunctions({
          functionType: 'system',
          project,
          query: '',
          transaction: '',
          selection,
          sort: '-p99',
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current.isLoading).toEqual(true);
    await hook.waitForNextUpdate();
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isLoading: false,
        isFetched: true,
        data: expect.arrayContaining([
          {
            functions: expect.any(Array),
          },
        ]),
      })
    );

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('fetches all functions', async function () {
    const mock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/profiling/functions/`,
      body: {functions: []},
      match: [MockApiClient.matchQuery({is_application: undefined})],
    });

    const hook = reactHooks.renderHook(
      () =>
        useFunctions({
          functionType: 'all',
          project,
          query: '',
          transaction: '',
          selection,
          sort: '-p99',
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current.isLoading).toEqual(true);
    await hook.waitForNextUpdate();
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isLoading: false,
        isFetched: true,
        data: expect.arrayContaining([
          {
            functions: expect.any(Array),
          },
        ]),
      })
    );

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('errors when selection is undefined or transaction is null', async function () {
    jest.spyOn(console, 'error').mockImplementation();
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/profiling/functions/`,
      body: {functions: []},
    });
    const hook = reactHooks.renderHook(
      () =>
        useFunctions({
          project,
          query: '',
          transaction: '',
          sort: '-p99',
        }),
      {wrapper: TestContext}
    );
    await hook.waitForNextUpdate();
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isError: true,
        error: expect.any(Error),
      })
    );
  });
});
