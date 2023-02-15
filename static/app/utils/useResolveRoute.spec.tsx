import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';

import useResolveRoute from './useResolveRoute';

describe('useResolveRoute', () => {
  let devUi, host;

  const organization = TestStubs.Organization();
  const otherOrg = TestStubs.Organization({
    features: ['customer-domains'],
    slug: 'other-org',
  });

  beforeEach(() => {
    devUi = window.__SENTRY_DEV_UI;
    host = window.location.host;
  });
  afterEach(() => {
    window.__SENTRY_DEV_UI = devUi;
    window.location.host = host;
  });

  it('should use sentryUrl when no org is provided', () => {
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'localhost:7999';

    const wrapper = ({children}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const {result} = reactHooks.renderHook(() => useResolveRoute('/organizations/new/'), {
      wrapper,
    });
    expect(result.current).toBe('/organizations/new/');
  });

  it('should replace domains with dev-ui mode on localhost', () => {
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'acme.localhost:7999';

    const wrapper = ({children}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const {result} = reactHooks.renderHook(() => useResolveRoute('/issues/', otherOrg), {
      wrapper,
    });
    expect(result.current).toBe('https://other-org.localhost:7999/issues/');
  });

  it('should replace domains with dev-ui mode on dev.getsentry.net', () => {
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'acme.dev.getsentry.net:7999';

    const wrapper = ({children}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const {result} = reactHooks.renderHook(() => useResolveRoute('/issues/', otherOrg), {
      wrapper,
    });
    expect(result.current).toBe('https://other-org.dev.getsentry.net:7999/issues/');
  });

  it('should replace domains with dev-ui mode on sentry.dev', () => {
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'acme.sentry-abc123.sentry.dev';

    const wrapper = ({children}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const {result} = reactHooks.renderHook(() => useResolveRoute('/issues/', otherOrg), {
      wrapper,
    });
    expect(result.current).toBe('https://other-org.sentry-abc123.sentry.dev/issues/');
  });

  it('will not replace domains with dev-ui mode and an unsafe host', () => {
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'bad-domain.com';

    const wrapper = ({children}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const {result} = reactHooks.renderHook(() => useResolveRoute('/issues/', otherOrg), {
      wrapper,
    });
    expect(result.current).toBe('https://other-org.sentry.io/issues/');
  });

  it('should not replace domains normally', () => {
    const wrapper = ({children}) => (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
    const {result} = reactHooks.renderHook(() => useResolveRoute('/issues/', otherOrg), {
      wrapper,
    });
    expect(result.current).toBe('https://other-org.sentry.io/issues/');
  });
});
