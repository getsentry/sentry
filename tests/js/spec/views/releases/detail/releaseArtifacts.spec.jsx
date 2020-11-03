import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import {ReleaseArtifacts} from 'app/views/releases/detail/releaseArtifacts';

describe('ReleaseArtifacts', function () {
  let wrapper;
  let wrapperWithPermission;
  const api = new Client();
  let projectMock;
  let organizationMock;
  let deleteMock;

  beforeEach(async function () {
    const mockResponse = [
      {
        id: '1',
        name: 'foo.js',
        size: 150000,
      },
      {
        id: '2',
        name: 'bar.js',
        size: 30000,
      },
    ];

    projectMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/releases/abcdef/files/',
      body: mockResponse,
    });

    organizationMock = MockApiClient.addMockResponse({
      url: '/organizations/123/releases/abcdef/files/',
      body: mockResponse,
    });

    deleteMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/releases/abcdef/files/1/',
      method: 'DELETE',
    });

    wrapper = mountWithTheme(
      <ReleaseArtifacts
        location={{query: {cursor: '0:0:100'}}}
        params={{orgId: '123', projectId: '456', release: 'abcdef'}}
        organization={TestStubs.Organization({id: '123', access: ['project:read']})}
        api={api}
      />
    );

    wrapperWithPermission = mountWithTheme(
      <ReleaseArtifacts
        location={{query: {cursor: '0:0:100'}}}
        params={{orgId: '123', projectId: '456', release: 'abcdef'}}
        organization={TestStubs.Organization({id: '123', access: ['project:write']})}
        api={api}
      />
    );

    await tick();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('render()', function () {
    it('should render a row for each file', function () {
      expect(wrapper.find('PanelItem')).toHaveLength(2);
    });

    it('should have no permission to download', function () {
      const buttons = wrapper.find('Button[data-test-id="artifact-download"]');
      expect(buttons).toHaveLength(2);
      expect(buttons.first().props().disabled).toBe(true);
    });

    it('should have permission to download', function () {
      wrapper = wrapperWithPermission;
      wrapper.setState({
        loading: false,
        fileList: [
          {
            id: '1',
            name: 'foo.js',
            size: 150000,
          },
          {
            id: '2',
            name: 'bar.js',
            size: 30000,
          },
        ],
      });

      const buttons = wrapper.find('Button[data-test-id="artifact-download"]');
      expect(buttons).toHaveLength(2);
      expect(buttons.first().props().disabled).toBe(false);
    });
  });

  describe('handleRemove()', function () {
    it('should remove the file from the file list', async function () {
      wrapper.instance().handleRemove('1');
      expect(deleteMock).toHaveBeenCalled();

      expect(wrapper.state('fileList')).toHaveLength(1);
      expect(wrapper.state('fileList')[0]).toHaveProperty('id', '2');
    });
  });

  describe('fetchData()', function () {
    it('fetches data for project releases', function () {
      wrapper.instance().fetchData();

      expect(projectMock).toHaveBeenCalledWith(
        '/projects/123/456/releases/abcdef/files/',
        expect.objectContaining({
          data: expect.objectContaining({
            cursor: '0:0:100',
          }),
        })
      );
    });

    it('fetches data for organization releases', function () {
      wrapper.setProps({params: {orgId: '123', release: 'abcdef'}});
      wrapper.instance().fetchData();

      expect(organizationMock).toHaveBeenCalledWith(
        '/organizations/123/releases/abcdef/files/',
        expect.objectContaining({
          data: expect.objectContaining({
            cursor: '0:0:100',
          }),
        })
      );
    });
  });
});
