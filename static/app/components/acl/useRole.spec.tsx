import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useRole} from 'sentry/components/acl/useRole';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/views/organizationContext';

function createWrapper(organization: Organization) {
  return function ({children}: {children: React.ReactNode}) {
    return (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
  };
}

describe('useRole', () => {
  const organization = OrganizationFixture({
    // User is an admin of this test org
    orgRole: 'admin',
    // For these tests, attachments will require an admin role
    attachmentsRole: 'admin',
    debugFilesRole: 'member',
  });

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
    // OrganizationStore is still called directly in isActiveSuperuser()
    OrganizationStore.init();
    OrganizationStore.onUpdate(organization, {replace: true});
  });

  it('has a sufficient role', () => {
    const {result} = renderHook(() => useRole({role: 'attachmentsRole'}), {
      wrapper: createWrapper(organization),
    });
    expect(result.current.hasRole).toBe(true);
    expect(result.current.roleRequired).toBe('admin');
  });

  it('has an insufficient role', () => {
    const org = OrganizationFixture({
      ...organization,
      orgRole: 'member',
    });
    OrganizationStore.onUpdate(org, {replace: true});
    const {result} = renderHook(() => useRole({role: 'attachmentsRole'}), {
      wrapper: createWrapper(org),
    });
    expect(result.current.hasRole).toBe(false);
  });

  it('gives access to a superuser with insufficient role', () => {
    const org = OrganizationFixture({
      ...organization,
      orgRole: 'member',
      access: ['org:superuser'],
    });
    OrganizationStore.onUpdate(org, {replace: true});
    const {result} = renderHook(() => useRole({role: 'attachmentsRole'}), {
      wrapper: createWrapper(org),
    });
    expect(result.current.hasRole).toBe(true);
  });

  it('handles no organization.orgRoleList', () => {
    const org = {...organization, orgRoleList: []};
    OrganizationStore.onUpdate(org, {replace: true});
    const {result} = renderHook(() => useRole({role: 'attachmentsRole'}), {
      wrapper: createWrapper(org),
    });
    expect(result.current.hasRole).toBe(false);
  });
});
