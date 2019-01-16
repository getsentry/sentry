/*global global*/
import React from 'react';

import {mount} from 'enzyme';
import FormModel from 'app/views/settings/components/forms/model';
import PermissionsObserver from 'app/views/settings/organizationDeveloperSettings/permissionsObserver';

describe('PermissionsObserver', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(
      <PermissionsObserver
        scopes={['project:read', 'project:write', 'project:releases', 'org:admin']}
        events={['issue']}
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
});
