import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationAccessRequests from 'app/views/settings/organizationMembers/organizationAccessRequests';

describe('OrganizationAccessRequests', function() {
  const orgId = 'org-slug';
  const accessRequest = TestStubs.AccessRequest();
  const requestList = [accessRequest];

  it('renders empty', function() {
    const wrapper = mountWithTheme(
      <OrganizationAccessRequests
        orgId={orgId}
        requestList={[]}
        onUpdateRequestList={() => {}}
      />
    );

    expect(wrapper.find('OrganizationAccessRequests').exists()).toBe(true);
  });

  it('renders list', function() {
    const wrapper = mountWithTheme(
      <OrganizationAccessRequests
        orgId={orgId}
        requestList={requestList}
        onUpdateRequestList={() => {}}
      />
    );

    expect(wrapper.find('PanelHeader').text()).toBe('Pending Team Requests');
    expect(
      wrapper
        .find('StyledPanelItem')
        .text()
        .includes(
          `${accessRequest.member.user.name} requests access to the #${
            accessRequest.team.slug
          } team`
        )
    ).toBe(true);
  });

  it('can approve', async function() {
    const onUpdateRequestListMock = jest.fn();
    const approveMock = MockApiClient.addMockResponse({
      url: `/organizations/${orgId}/access-requests/${accessRequest.id}/`,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <OrganizationAccessRequests
        orgId={orgId}
        requestList={requestList}
        onUpdateRequestList={onUpdateRequestListMock}
      />
    );

    wrapper.find('button[aria-label="Approve"]').simulate('click');

    await tick();

    expect(approveMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          isApproved: true,
        },
      })
    );
    expect(onUpdateRequestListMock).toHaveBeenCalledWith(accessRequest.id);
  });

  it('can deny', async function() {
    const onUpdateRequestListMock = jest.fn();
    const denyMock = MockApiClient.addMockResponse({
      url: `/organizations/${orgId}/access-requests/${accessRequest.id}/`,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <OrganizationAccessRequests
        orgId={orgId}
        requestList={requestList}
        onUpdateRequestList={onUpdateRequestListMock}
      />
    );

    wrapper.find('button[aria-label="Deny"]').simulate('click');

    await tick();

    expect(denyMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          isApproved: false,
        },
      })
    );
    expect(onUpdateRequestListMock).toHaveBeenCalledWith(accessRequest.id);
  });
});
