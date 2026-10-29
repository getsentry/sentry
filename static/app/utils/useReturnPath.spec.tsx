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

  it('does not capture without a key', () => {
    renderHookWithProviders(
      () => useCaptureReturnPath({key: null, excludePrefix: '/settings'}),
      {initialRouterConfig: {location: {pathname: '/issues/'}}}
    );

    expect(getReturnPath(KEY, '/fallback/')).toBe('/fallback/');
  });

  it('does not capture locations under the excluded prefix', () => {
    renderHookWithProviders(() => useCaptureReturnPath(options), {
      initialRouterConfig: {location: {pathname: '/settings/org-slug/members/'}},
    });

    expect(getReturnPath(KEY, '/fallback/')).toBe('/fallback/');
  });

  it.each(['//attacker.example/', '/\\attacker.example/', 'https://attacker.example/'])(
    'falls back instead of returning to another site via %s',
    path => {
      sessionStorage.setItem(KEY, path);

      expect(getReturnPath(KEY, '/fallback/')).toBe('/fallback/');
    }
  );
});
