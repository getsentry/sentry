import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useOurLogsSelectionEnabled} from 'sentry/views/explore/logs/selection/useOurLogsSelection';

describe('useOurLogsSelectionEnabled', () => {
  it('returns true when the organization has the ourlogs-selection feature', () => {
    const {result} = renderHookWithProviders(() => useOurLogsSelectionEnabled(), {
      organization: OrganizationFixture({features: ['ourlogs-selection']}),
    });

    expect(result.current).toBe(true);
  });

  it('returns true when the location query has logsSelection set to true', () => {
    const {result} = renderHookWithProviders(() => useOurLogsSelectionEnabled(), {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {
        location: {pathname: '/', query: {logsSelection: 'true'}},
      },
    });

    expect(result.current).toBe(true);
  });

  it('returns false when neither the feature nor the query are set', () => {
    const {result} = renderHookWithProviders(() => useOurLogsSelectionEnabled(), {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {
        location: {pathname: '/'},
      },
    });

    expect(result.current).toBe(false);
  });

  it('returns false when the location query has logsSelection set to a value other than true', () => {
    const {result} = renderHookWithProviders(() => useOurLogsSelectionEnabled(), {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {
        location: {pathname: '/', query: {logsSelection: 'false'}},
      },
    });

    expect(result.current).toBe(false);
  });
});
