import {ReactElement, useMemo} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
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
          version: '',
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current).toEqual({type: 'initial'});
  });

  it('fetches functions', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/profiling/functions/`,
      body: {
        Versions: {
          '': {
            FunctionCalls: [],
          },
        },
      },
    });

    const hook = reactHooks.renderHook(
      () =>
        useFunctions({
          project,
          query: '',
          transaction: '',
          version: '',
          selection,
        }),
      {wrapper: TestContext}
    );
    expect(hook.result.current).toEqual({type: 'loading'});
    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      type: 'resolved',
      data: [],
    });
  });
});
