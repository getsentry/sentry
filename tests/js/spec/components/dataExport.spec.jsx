import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import Button from 'app/components/button';
import WrappedDataExport, {DataExport} from 'app/components/dataExport';

describe('DataExport', function() {
  const mockUnauthorizedOrg = TestStubs.Organization({
    features: [],
  });
  const mockAuthorizedOrg = TestStubs.Organization({
    features: ['data-export'],
  });
  const mockPayload = {
    queryType: 'Issues-by-Tag',
    queryInfo: {project_id: '1', group_id: '1027', key: 'user'},
  };
  const mockRouterContext = mockOrganization =>
    TestStubs.routerContext([
      {
        organization: mockOrganization,
      },
    ]);

  it('should not render anything for an unauthorized organization', function() {
    const wrapper = mountWithTheme(
      <WrappedDataExport payload={mockPayload} />,
      mockRouterContext(mockUnauthorizedOrg)
    );
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('should render the button for an authorized organization', function() {
    const wrapper = mountWithTheme(
      <WrappedDataExport payload={mockPayload} />,
      mockRouterContext(mockAuthorizedOrg)
    );
    expect(wrapper.isEmptyRender()).toBe(false);
    expect(wrapper.text()).toContain('Export All to CSV');
  });

  it('should render custom children if provided', function() {
    const testString = 'This is an example string';
    const wrapper = mountWithTheme(
      <WrappedDataExport payload={mockPayload}>{testString}</WrappedDataExport>,
      mockRouterContext(mockAuthorizedOrg)
    );
    expect(wrapper.text()).toContain(testString);
  });

  it('should respect the disabled prop and not be clickable', function() {
    const url = `/organizations/${mockAuthorizedOrg.slug}/data-export/`;
    const postDataExport = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {id: 721},
    });
    const wrapper = mountWithTheme(
      <WrappedDataExport payload={mockPayload} disabled />,
      mockRouterContext(mockAuthorizedOrg)
    );
    expect(wrapper.find(Button).prop('disabled')).toBe(true);
    wrapper.find('button').simulate('click');
    expect(postDataExport).not.toHaveBeenCalled();
  });

  it('should send a request and disable itself when clicked', async function() {
    const url = `/organizations/${mockAuthorizedOrg.slug}/data-export/`;
    const postDataExport = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {id: 721},
    });
    const wrapper = mountWithTheme(
      <WrappedDataExport payload={mockPayload} />,
      mockRouterContext(mockAuthorizedOrg)
    );
    wrapper.find('button').simulate('click');
    expect(wrapper.find(DataExport).state()).toEqual({
      inProgress: false,
    });
    expect(postDataExport).toHaveBeenCalledWith(url, {
      data: {
        query_type: mockPayload.queryType,
        query_info: mockPayload.queryInfo,
      },
      method: 'POST',
      error: expect.anything(),
      success: expect.anything(),
    });
    await tick();
    wrapper.update();
    expect(wrapper.text()).toContain("We're working on it...");
    expect(wrapper.find(Button).prop('disabled')).toBe(true);
    expect(wrapper.find(DataExport).state()).toEqual({
      inProgress: true,
      dataExportId: 721,
    });
  });
});
