import {ReactNode, useMemo} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import {useProfiles} from 'sentry/utils/profiling/hooks/useProfiles';
import {OrganizationContext} from 'sentry/views/organizationContext';

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

function TestContext({children}: {children?: ReactNode}) {
  const {organization} = useMemo(() => initializeOrg(), []);

  return (
    <OrganizationContext.Provider value={organization}>
      {children}
    </OrganizationContext.Provider>
  );
}

describe('useProfiles', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('initializes with the initial state', function () {
    const hook = reactHooks.renderHook(useProfiles, {
      wrapper: TestContext,
      initialProps: {query: ''},
    });
    expect(hook.result.current).toEqual({type: 'initial'});
  });

  it('fetches profiles', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/profiles/',
      body: [],
    });

    const hook = reactHooks.renderHook(useProfiles, {
      wrapper: TestContext,
      initialProps: {query: '', selection},
    });
    expect(hook.result.current).toEqual({type: 'loading'});
    await hook.waitForNextUpdate();
    expect(hook.result.current).toEqual({
      type: 'resolved',
      data: {traces: [], pageLinks: null},
    });
  });
});
