import {getReactRouterVersion} from './reactRouterVersion';

describe('React Router version selection', () => {
  it('defaults local development and tests to v8', () => {
    expect(getReactRouterVersion({})).toBe('8');
  });

  it('allows local development and tests to select v6', () => {
    expect(getReactRouterVersion({SENTRY_REACT_ROUTER_VERSION: '6'})).toBe('6');
  });

  it.each([undefined, '6', '8'])('keeps production on v6 with override %s', version => {
    expect(getReactRouterVersion({SENTRY_REACT_ROUTER_VERSION: version}, false)).toBe(
      '6'
    );
  });

  it('rejects an invalid version', () => {
    expect(() => getReactRouterVersion({SENTRY_REACT_ROUTER_VERSION: '7'})).toThrow(
      'SENTRY_REACT_ROUTER_VERSION must be 6 or 8'
    );
  });
});
