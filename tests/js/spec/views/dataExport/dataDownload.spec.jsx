import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {ExportQueryType} from 'app/components/dataExport';
import DataDownload, {DownloadStatus} from 'app/views/dataExport/dataDownload';

describe('DataDownload', function() {
  beforeEach(MockApiClient.clearMockResponses);
  const dateExpired = new Date();
  const organization = TestStubs.Organization();
  const mockRouteParams = {
    orgId: organization.slug,
    dataExportId: 721,
  };
  const getDataExportDetails = (body, statusCode = 200) =>
    MockApiClient.addMockResponse({
      url: `/organizations/${mockRouteParams.orgId}/data-export/${mockRouteParams.dataExportId}/`,
      body,
      statusCode,
    });

  it('should send a request to the data export endpoint', function() {
    const getValid = getDataExportDetails(DownloadStatus.Valid);
    mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(getValid).toHaveBeenCalled();
  });

  it("should render the 'Error' view when appropriate", function() {
    const errors = {
      download: {
        status: 403,
        statusText: 'Forbidden',
        responseJSON: {
          detail: 'You are not allowed',
        },
      },
    };
    getDataExportDetails({errors}, 403);
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(wrapper.state('errors')).toBeDefined();
    expect(wrapper.state('errors').download.status).toBe(403);
  });

  it("should render the 'Early' view when appropriate", function() {
    const status = DownloadStatus.Early;
    getDataExportDetails({status});
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(wrapper.state('download')).toEqual({status});
    expect(wrapper.state('download').dateExpired).toBeUndefined();
    expect(wrapper.find('Header').text()).toBe('What are you doing here?');
  });

  it("should render the 'Expired' view when appropriate", function() {
    const status = DownloadStatus.Expired;
    const response = {status, query: {type: ExportQueryType.IssuesByTag}};
    getDataExportDetails(response);
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(wrapper.state('download')).toEqual(response);
    expect(wrapper.state('download').dateExpired).toBeUndefined();
    expect(wrapper.find('Header').text()).toBe('This is awkward.');
    const buttonWrapper = wrapper.find('a[aria-label="Start a New Download"]');
    expect(buttonWrapper.prop('href')).toBe(
      `/organizations/${mockRouteParams.orgId}/issues/`
    );
  });

  it("should render the 'Valid' view when appropriate", function() {
    const status = DownloadStatus.Valid;
    getDataExportDetails({dateExpired, status});
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    expect(wrapper.state('download')).toEqual({dateExpired, status});
    expect(wrapper.find('Header').text()).toBe('All done.');
    const buttonWrapper = wrapper.find('a[aria-label="Download CSV"]');
    expect(buttonWrapper.text()).toBe('Download CSV');
    expect(buttonWrapper.prop('href')).toBe(
      `/api/0/organizations/${mockRouteParams.orgId}/data-export/${mockRouteParams.dataExportId}/?download=true`
    );
    expect(wrapper.find('DateTime').prop('date')).toEqual(new Date(dateExpired));
  });

  it('should render the Open in Discover button when needed', function() {
    const status = DownloadStatus.Valid;
    getDataExportDetails({
      dateExpired,
      status,
      query: {
        type: ExportQueryType.Discover,
        info: {},
      },
    });
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    const buttonWrapper = wrapper.find('button[aria-label="Open in Discover"]');
    expect(buttonWrapper.exists()).toBeTruthy();
  });

  it('should not render the Open in Discover button when not needed', function() {
    const status = DownloadStatus.Valid;
    getDataExportDetails({
      dateExpired,
      status,
      query: {
        type: ExportQueryType.IssuesByTag,
        info: {},
      },
    });
    const wrapper = mountWithTheme(<DataDownload params={mockRouteParams} />);
    const buttonWrapper = wrapper.find('button[aria-label="Open in Discover"]');
    expect(buttonWrapper.exists()).toBeFalsy();
  });
});
