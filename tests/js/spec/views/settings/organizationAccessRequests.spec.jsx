import React from 'react';
import {mount, shallow} from 'enzyme';

import OrganizationAccessRequests from 'app/views/settings/organizationMembers/organizationAccessRequests';

describe('OrganizationAccessRequests', function() {
  beforeEach(function() {});

  it('renders empty', function() {
    const wrapper = shallow(
      <OrganizationAccessRequests
        params={{apiKey: 1, orgId: 'org-slug'}}
        onApprove={() => {}}
        onDeny={() => {}}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders list', function() {
    const wrapper = shallow(
      <OrganizationAccessRequests
        params={{apiKey: 1, orgId: 'org-slug'}}
        accessRequestBusy={new Map()}
        requestList={[
          {
            id: 'id',
            member: {
              id: 'memberid',
              email: '',
              name: '',
              role: '',
              roleName: '',
              user: {
                id: '',
                name: 'sentry@test.com',
              },
            },
            team: TestStubs.Team(),
          },
        ]}
        onApprove={() => {}}
        onDeny={() => {}}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('can approve', function() {
    const mock = jest.fn();
    const wrapper = mount(
      <OrganizationAccessRequests
        params={{apiKey: 1, orgId: 'org-slug'}}
        accessRequestBusy={new Map()}
        requestList={[
          {
            id: 'id',
            member: {
              id: 'memberid',
              email: '',
              name: '',
              role: '',
              roleName: '',
              user: {
                id: '',
                name: 'sentry@test.com',
              },
            },
            team: TestStubs.Team(),
          },
        ]}
        onApprove={mock}
        onDeny={() => {}}
      />,
      TestStubs.routerContext()
    );

    wrapper
      .find('Button')
      .first()
      .simulate('click');
    expect(mock).toHaveBeenCalled();
  });

  it('can deny', function() {
    const mock = jest.fn();
    const wrapper = mount(
      <OrganizationAccessRequests
        params={{apiKey: 1, orgId: 'org-slug'}}
        accessRequestBusy={new Map()}
        requestList={[
          {
            id: 'id',
            member: {
              id: 'memberid',
              email: '',
              name: '',
              role: '',
              roleName: '',
              user: {
                id: '',
                name: 'sentry@test.com',
              },
            },
            team: TestStubs.Team(),
          },
        ]}
        onApprove={() => {}}
        onDeny={mock}
      />,
      TestStubs.routerContext()
    );

    wrapper
      .find('Button')
      .last()
      .simulate('click');
    expect(mock).toHaveBeenCalled();
  });
});
