import {mountWithTheme} from 'sentry-test/enzyme';

import Form from 'app/views/settings/components/forms/form';
import PermissionsObserver from 'app/views/settings/organizationDeveloperSettings/permissionsObserver';

describe('PermissionsObserver', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mountWithTheme(
      <Form>
        <PermissionsObserver
          scopes={['project:read', 'project:write', 'project:releases', 'org:admin']}
          events={['issue']}
        />
      </Form>,
      TestStubs.routerContext()
    );
  });

  it('defaults to no-access for all resources not passed', () => {
    const instance = wrapper.find('PermissionsObserver').instance();
    expect(instance.state.permissions).toEqual(
      expect.objectContaining({
        Team: 'no-access',
        Event: 'no-access',
        Member: 'no-access',
      })
    );
  });

  it('converts a raw list of scopes into permissions', () => {
    const instance = wrapper.find('PermissionsObserver').instance();
    expect(instance.state.permissions).toEqual(
      expect.objectContaining({
        Project: 'write',
        Release: 'admin',
        Organization: 'admin',
      })
    );
  });

  it('selects the highest ranking scope to convert to permission', () => {
    const instance = wrapper.find('PermissionsObserver').instance();
    expect(instance.state.permissions.Project).toEqual('write');
  });
});
