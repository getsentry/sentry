import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {Scope} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useAccess} from './useAccess';

describe('useAccess', () => {
  const hasAccessScopes: Scope[] = ['project:write', 'project:read', 'org:read'];
  const noAccessScopes: Scope[] = ['org:write'];
  const organization = TestStubs.Organization({
    access: hasAccessScopes,
  });
  const wrapper = ({children}: {children?: React.ReactNode}) => (
    <OrganizationContext.Provider value={organization}>
      {children}
    </OrganizationContext.Provider>
  );

  it('has access', () => {
    const {result} = reactHooks.renderHook(useAccess, {
      initialProps: {
        access: hasAccessScopes,
      },
      wrapper,
    });

    expect(result.current).toBe(true);
  });
  it('has no access', function () {
    const {result} = reactHooks.renderHook(useAccess, {
      initialProps: {
        access: noAccessScopes,
      },
      wrapper,
    });

    expect(result.current).toBe(false);
  });
  it('has access when requireAll is false', function () {
    const {result} = reactHooks.renderHook(useAccess, {
      initialProps: {
        access: [...hasAccessScopes, ...noAccessScopes],
        requireAll: false,
      },
      wrapper,
    });

    expect(result.current).toBe(true);
  });
  it('has access with empty scope array', () => {
    const {result} = reactHooks.renderHook(useAccess, {
      initialProps: {
        access: [],
      },
      wrapper,
    });

    expect(result.current).toBe(true);
  });
});
