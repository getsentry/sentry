import React from 'react';
import {shallow, mount} from 'enzyme';

import OrganizationAccessRequests from 'app/views/settings/organization/members/organizationAccessRequests';
import {ThemeProvider} from 'emotion-theming';

describe('OrganizationAccessRequests', function() {
  beforeEach(function() {});

  it('renders empty', function() {
    let wrapper = shallow(
      <OrganizationAccessRequests
        params={{apiKey: 1, orgId: 'org-slug'}}
        onApprove={() => {}}
        onDeny={() => {}}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders list', function() {
    let wrapper = shallow(
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
    let mock = jest.fn();
    let wrapper = mount(
      <ThemeProvider theme={{}}>
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
        />
      </ThemeProvider>
    );

    wrapper
      .find('Button')
      .first()
      .simulate('click');
    expect(mock).toHaveBeenCalled();
  });

  it('can deny', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <ThemeProvider theme={{}}>
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
        />
      </ThemeProvider>
    );

    wrapper
      .find('Button')
      .last()
      .simulate('click');
    expect(mock).toHaveBeenCalled();
  });
});
