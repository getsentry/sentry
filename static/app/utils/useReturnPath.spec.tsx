import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {getReturnPath, useCaptureReturnPath} from 'sentry/utils/useReturnPath';

const KEY = 'test-return-path';
const options = {key: KEY, excludePrefix: '/settings'};

describe('useReturnPath', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('captures locations outside the excluded prefix', () => {
    renderHookWithProviders(() => useCaptureReturnPath(options), {
      initialRouterConfig: {
        location: {pathname: '/issues/', query: {query: 'is:unresolved'}},
      },
    });

    expect(getReturnPath(KEY, '/fallback/')).toBe('/issues/?query=is%3Aunresolved');
  });

  it('does not capture locations under the excluded prefix', () => {
    renderHookWithProviders(() => useCaptureReturnPath(options), {
      initialRouterConfig: {location: {pathname: '/settings/org-slug/members/'}},
    });

    expect(getReturnPath(KEY, '/fallback/')).toBe('/fallback/');
  });
});
