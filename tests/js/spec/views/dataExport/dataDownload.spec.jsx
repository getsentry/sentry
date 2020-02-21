import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import DataDownload, {DownloadStatus} from 'app/views/dataExport/dataDownload';

describe('DataDownload', function() {
  beforeEach(MockApiClient.clearMockResponses);
  const dateExpired = new Date();
  const mockRouteParams = {
    orgId: 'acme',
    dataExportId: 721,
  };
  const getDataExportDetails = body =>
    MockApiClient.addMockResponse({
      url: `/organizations/${mockRouteParams.orgId}/data-export/${mockRouteParams.dataExportId}/`,
      body,
    });

  it('should send a request to the data export endpoint', function() {
    const getValid = getDataExportDetails(DownloadStatus.Valid);
    mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(getValid).toHaveBeenCalled();
  });

  it("should render the 'Early' view when appropriate", function() {
    const status = DownloadStatus.Early;
    getDataExportDetails({status});
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(wrapper.state('download')).toEqual({status});
    expect(wrapper.state('download').dateExpired).toBeUndefined();
    const contentWrapper = wrapper.find('div[data-test="datadownload-wrapper"]');
    expect(contentWrapper.children()).toHaveLength(3);
    expect(contentWrapper.find('h3').text()).toBe("You're Early!");
  });

  it("should render the 'Expired' view when appropriate", function() {
    const status = DownloadStatus.Expired;
    getDataExportDetails({status});
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(wrapper.state('download')).toEqual({status});
    expect(wrapper.state('download').dateExpired).toBeUndefined();
    const contentWrapper = wrapper.find('div[data-test="datadownload-wrapper"]');
    expect(contentWrapper.children()).toHaveLength(3);
    expect(contentWrapper.find('h3').text()).toBe('Sorry!');
  });

  it("should render the 'Valid' view when appropriate", function() {
    const status = DownloadStatus.Valid;
    getDataExportDetails({status, dateExpired});
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(wrapper.state('download')).toEqual({dateExpired, status});
    const contentWrapper = wrapper.find('div[data-test="datadownload-wrapper"]');
    expect(contentWrapper.children()).toHaveLength(5);
    expect(contentWrapper.find('h3').text()).toBe('Finally!');
    const buttonWrapper = contentWrapper.find('a[data-test="datadownload-button"]');
    expect(buttonWrapper.text()).toBe('Download CSV');
    expect(buttonWrapper.props().href).toBe(
      `/api/0/organizations/${mockRouteParams.orgId}/data-export/${mockRouteParams.dataExportId}/?download=true`
    );
    const dateString = d => `${d.toLocaleDateString()}, ${d.toLocaleTimeString()}`;
    expect(contentWrapper.find('b').text()).toBe(dateString(dateExpired));
  });
});
