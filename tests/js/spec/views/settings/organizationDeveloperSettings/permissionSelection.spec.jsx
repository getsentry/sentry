/*global global*/
import React from 'react';

import {mount} from 'enzyme';
import FormModel from 'app/views/settings/components/forms/model';
import PermissionSelection from 'app/views/settings/organizationDeveloperSettings/permissionSelection';
import {selectByValue, openMenu} from './../../../../helpers/select';

describe('PermissionSelection', () => {
  let wrapper;
  let onChange;

  beforeEach(() => {
    onChange = jest.fn();
    wrapper = mount(
      <PermissionSelection
        scopes={['project:read', 'project:write', 'project:releases', 'org:admin']}
        onChange={onChange}
      />,
      {
        context: {
          router: TestStubs.routerContext(),
          form: new FormModel(),
        },
      }
    );
  });

  it('defaults to no-access for all resources not passed', () => {
    expect(wrapper.instance().state.permissions).toEqual(
      expect.objectContaining({
        Team: 'no-access',
        Event: 'no-access',
        Member: 'no-access',
      })
    );
  });

  it('converts a raw list of scopes into permissions', () => {
    expect(wrapper.instance().state.permissions).toEqual(
      expect.objectContaining({
        Project: 'write',
        Release: 'admin',
        Organization: 'admin',
      })
    );
  });

  it('selects the highest ranking scope to convert to permission', () => {
    expect(wrapper.instance().state.permissions.Project).toEqual('write');
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
    wrapper.instance().setState({
      permissions: {
        Project: 'write',
        Release: 'admin',
        Organization: 'read',
      },
    });

    expect(wrapper.instance().permissionStateToList()).toEqual([
      'project:read',
      'project:write',
      'project:releases',
      'org:read',
    ]);
  });

  it('stores the permissions the User has selected', () => {
    const getStateValue = resource => {
      return wrapper.instance().state.permissions[resource];
    };

    selectByValue(wrapper, 'write', {name: 'Project--permission'});
    selectByValue(wrapper, 'read', {name: 'Team--permission'});
    selectByValue(wrapper, 'admin', {name: 'Release--permission'});
    selectByValue(wrapper, 'admin', {name: 'Event--permission'});
    selectByValue(wrapper, 'read', {name: 'Organization--permission'});

    expect(getStateValue('Project')).toEqual('write');
    expect(getStateValue('Team')).toEqual('read');
    expect(getStateValue('Release')).toEqual('admin');
    expect(getStateValue('Event')).toEqual('admin');
    expect(getStateValue('Organization')).toEqual('read');
    expect(getStateValue('Member')).toEqual('no-access');
  });
});
