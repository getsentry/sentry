import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useOurLogsPinningEnabled} from 'sentry/views/explore/logs/pinning/useOurLogsPinning';

describe('useOurLogsPinningEnabled', () => {
  it('returns true when the organization has the ourlogs-pinning feature', () => {
    const {result} = renderHookWithProviders(() => useOurLogsPinningEnabled(), {
      organization: OrganizationFixture({features: ['ourlogs-pinning']}),
    });

    expect(result.current).toBe(true);
  });

  it('returns true when the location query has logsPinning set to true', () => {
    const {result} = renderHookWithProviders(() => useOurLogsPinningEnabled(), {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinning: 'true'}},
      },
    });

    expect(result.current).toBe(true);
  });

  it('returns false when neither the feature nor the query are set', () => {
    const {result} = renderHookWithProviders(() => useOurLogsPinningEnabled(), {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {
        location: {pathname: '/'},
      },
    });

    expect(result.current).toBe(false);
  });

  it('returns false when the location query has logsPinning set to a value other than true', () => {
    const {result} = renderHookWithProviders(() => useOurLogsPinningEnabled(), {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinning: 'false'}},
      },
    });

    expect(result.current).toBe(false);
  });
});
