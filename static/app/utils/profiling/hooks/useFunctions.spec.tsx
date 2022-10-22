import {ReactElement, useMemo} from 'react';
import {Project} from 'fixtures/js-stubs/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
import {OrganizationContext} from 'sentry/views/organizationContext';

const project = Project();

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

function TestContext({children}: {children: ReactElement}) {
  const {organization} = useMemo(() => initializeOrg(), []);

  return (
    <OrganizationContext.Provider value={organization}>
      {children}
    </OrganizationContext.Provider>
  );
}

describe('useFunctions', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('initializes with the loading state', function () {
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
    expect(hook.result.current).toEqual({type: 'initial'});
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
    expect(hook.result.current).toEqual({type: 'loading'});
    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      type: 'resolved',
      data: {
        functions: [],
        pageLinks: null,
      },
    });
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
    expect(hook.result.current).toEqual({type: 'loading'});
    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      type: 'resolved',
      data: {
        functions: [],
        pageLinks: null,
      },
    });

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
    expect(hook.result.current).toEqual({type: 'loading'});
    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      type: 'resolved',
      data: {
        functions: [],
        pageLinks: null,
      },
    });

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
    expect(hook.result.current).toEqual({type: 'loading'});
    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      type: 'resolved',
      data: {
        functions: [],
        pageLinks: null,
      },
    });

    expect(mock).toHaveBeenCalledTimes(1);
  });
});
