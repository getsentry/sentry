import {mountWithTheme} from 'sentry-test/enzyme';
import {openMenu, selectByValue} from 'sentry-test/select-new';

import Form from 'sentry/components/forms/form';
import PermissionSelection from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';

describe('PermissionSelection', () => {
  let wrapper;
  let onChange;

  beforeEach(() => {
    onChange = jest.fn();
    wrapper = mountWithTheme(
      <Form>
        <PermissionSelection
          permissions={{
            Event: 'no-access',
            Team: 'no-access',
            Project: 'write',
            Release: 'admin',
            Organization: 'admin',
          }}
          onChange={onChange}
        />
      </Form>
    );
  });

  it('renders a row for each resource', () => {
    expect(wrapper.find('SelectField[key="Project"]')).toBeDefined();
    expect(wrapper.find('SelectField[key="Team"]')).toBeDefined();
    expect(wrapper.find('SelectField[key="Release"]')).toBeDefined();
    expect(wrapper.find('SelectField[key="Event"]')).toBeDefined();
    expect(wrapper.find('SelectField[key="Organization"]')).toBeDefined();
    expect(wrapper.find('SelectField[key="Member"]')).toBeDefined();
  });

  it('lists human readable permissions', () => {
    const findOptions = name => {
      openMenu(wrapper, {name: `${name}--permission`});
      return wrapper
        .find(`SelectField[name="${name}--permission"] Option`)
        .map(o => o.text());
    };

    expect(findOptions('Project')).toEqual([
      'No Access',
      'Read',
      'Read & Write',
      'Admin',
    ]);
    expect(findOptions('Team')).toEqual(['No Access', 'Read', 'Read & Write', 'Admin']);
    expect(findOptions('Release')).toEqual(['No Access', 'Admin']);
    expect(findOptions('Event')).toEqual(['No Access', 'Read', 'Read & Write', 'Admin']);
    expect(findOptions('Organization')).toEqual([
      'No Access',
      'Read',
      'Read & Write',
      'Admin',
    ]);
    expect(findOptions('Member')).toEqual(['No Access', 'Read', 'Read & Write', 'Admin']);
  });

  it('converts permission state to a list of raw scopes', () => {
    const instance = wrapper.find('PermissionSelection').instance();
    instance.setState({
      permissions: {
        Project: 'write',
        Release: 'admin',
        Organization: 'read',
      },
    });

    expect(instance.permissionStateToList()).toEqual([
      'project:read',
      'project:write',
      'project:releases',
      'org:read',
    ]);
  });

  it('stores the permissions the User has selected', () => {
    const instance = wrapper.find('PermissionSelection').instance();
    const getStateValue = resource => instance.state.permissions[resource];

    selectByValue(wrapper, 'write', {name: 'Project--permission'});
    selectByValue(wrapper, 'read', {name: 'Team--permission'});
    selectByValue(wrapper, 'admin', {name: 'Release--permission'});
    selectByValue(wrapper, 'admin', {name: 'Event--permission'});
    selectByValue(wrapper, 'read', {name: 'Organization--permission'});
    selectByValue(wrapper, 'no-access', {name: 'Member--permission'});

    expect(getStateValue('Project')).toEqual('write');
    expect(getStateValue('Team')).toEqual('read');
    expect(getStateValue('Release')).toEqual('admin');
    expect(getStateValue('Event')).toEqual('admin');
    expect(getStateValue('Organization')).toEqual('read');
    expect(getStateValue('Member')).toEqual('no-access');
  });
});
