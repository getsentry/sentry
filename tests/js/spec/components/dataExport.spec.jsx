import React from 'react';
import {mount} from 'sentry-test/enzyme';

import WrappedDataExport, {DataExport} from 'app/components/dataExport';

describe('DataExport', function() {
  const mockUnauthorizedOrg = TestStubs.Organization({
    features: [],
  });
  const mockAuthorizedOrg = TestStubs.Organization({
    features: ['data-export'],
  });
  const mockPayload = {
    query_type: 2,
    query_info: {project_id: '1', group_id: '1027', key: 'user'},
  };
  const mockRouterContext = mockOrganization =>
    TestStubs.routerContext([
      {
        organization: mockOrganization,
      },
    ]);

  it('should not render anything for an unauthorized organization', function() {
    const wrapper = mount(
      <WrappedDataExport payload={mockPayload} />,
      mockRouterContext(mockUnauthorizedOrg)
    );
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('should render the button for an authorized organization', function() {
    const wrapper = mount(
      <WrappedDataExport payload={mockPayload} />,
      mockRouterContext(mockAuthorizedOrg)
    );
    expect(wrapper.isEmptyRender()).toBe(false);
    expect(wrapper.text()).toBe('Export All to CSV');
  });

  it('should send a request and disable itself when clicked', async function() {
    const url = `/organizations/${mockAuthorizedOrg.slug}/data-export/`;
    const postDataExport = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {id: 721},
    });
    const wrapper = mount(
      <WrappedDataExport payload={mockPayload} />,
      mockRouterContext(mockAuthorizedOrg)
    );
    wrapper.find('button').simulate('click');
    expect(wrapper.find(DataExport).state()).toEqual({
      inProgress: false,
    });
    expect(postDataExport).toHaveBeenCalledWith(url, {
      data: mockPayload,
      method: 'POST',
      error: expect.anything(),
      success: expect.anything(),
    });
    await tick();
    wrapper.update();
    expect(wrapper.text()).toBe('Queued up!');
    expect(wrapper.find('button').is('[disabled]')).toBe(true);
    expect(wrapper.find(DataExport).state()).toEqual({
      inProgress: true,
      dataExportId: 721,
    });
  });
});
