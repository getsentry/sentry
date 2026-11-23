import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {useOAuthOrganization} from './useOAuthOrganization';

it('scopes organization selection to the prepared consent session', () => {
  const originalConfig = ConfigStore.getState();
  const organizations = [
    OrganizationFixture({id: '1', slug: 'first-org'}),
    OrganizationFixture({id: '2', slug: 'second-org'}),
  ];
  ConfigStore.set('lastOrganization', 'first-org');

  try {
    const {result, rerender} = renderHook(
      ({consentKey}) => useOAuthOrganization(organizations, consentKey),
      {initialProps: {consentKey: 'first-session'}}
    );
    expect(result.current.organization).toBe(organizations[0]);

    act(() => result.current.onChange('2'));

    expect(result.current.organization).toBe(organizations[1]);

    rerender({consentKey: 'second-session'});

    expect(result.current.organization).toBe(organizations[0]);
  } finally {
    ConfigStore.loadInitialData(originalConfig);
  }
});
