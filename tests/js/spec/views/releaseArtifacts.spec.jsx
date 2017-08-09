import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import ReleaseArtifacts from 'app/views/releaseArtifacts';

describe('ReleaseArtifacts', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');

    this.wrapper = shallow(
      <ReleaseArtifacts
        location={{query: {cursor: '0:0:100'}}}
        params={{orgId: '123', projectId: '456', version: 'abcdef'}}
      />,
      {
        context: {
          group: {id: '1337'},
          project: {id: 'foo'},
          team: {id: '1'},
          organization: {id: 'bar'}
        }
      }
    );

    this.wrapperWithPermission = shallow(
      <ReleaseArtifacts
        location={{query: {cursor: '0:0:100'}}}
        params={{orgId: '123', projectId: '456', version: 'abcdef'}}
      />,
      {
        context: {
          group: {id: '1337'},
          project: {id: 'foo'},
          team: {id: '1'},
          organization: {id: 'bar', access: ['project:write']}
        }
      }
    );
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    it('should render a row for each file', function() {
      let wrapper = this.wrapper;
      wrapper.setState({
        loading: false,
        fileList: [
          {
            id: '1',
            name: 'foo.js',
            size: 150000
          },
          {
            id: '2',
            name: 'bar.js',
            size: 30000
          }
        ]
      });

      expect(wrapper.find('.list-group-item')).toHaveLength(2);
    });

    it('should have no permission to download', function() {
      let wrapper = this.wrapper;
      wrapper.setState({
        loading: false,
        fileList: [
          {
            id: '1',
            name: 'foo.js',
            size: 150000
          },
          {
            id: '2',
            name: 'bar.js',
            size: 30000
          }
        ]
      });

      expect(wrapper.find('div.btn > .icon-open')).toHaveLength(2);
    });

    it('should have permission to download', function() {
      let wrapper = this.wrapperWithPermission;
      wrapper.setState({
        loading: false,
        fileList: [
          {
            id: '1',
            name: 'foo.js',
            size: 150000
          },
          {
            id: '2',
            name: 'bar.js',
            size: 30000
          }
        ]
      });

      expect(wrapper.find('a.btn > .icon-open')).toHaveLength(2);
    });
  });

  describe('handleRemove()', function() {
    it('should remove the file from the file list', function() {
      let wrapper = this.wrapper;
      wrapper.setState({
        loading: false,
        fileList: [
          {
            id: '1',
            name: 'foo.js',
            size: 150000
          },
          {
            id: '2',
            name: 'bar.js',
            size: 30000
          }
        ]
      });

      let instance = wrapper.instance();
      this.stubbedApiRequest.restore();
      this.sandbox.stub(instance.api, 'request', function(url, options) {
        // emulate successful api completion
        options.success();
        options.complete();
      });

      instance.handleRemove('1');
      expect(instance.api.request.callCount).toEqual(1);
      expect(wrapper.state('fileList')).toHaveLength(1);
      expect(wrapper.state('fileList')[0]).toHaveProperty('id', '2');
    });
  });

  describe('fetchData()', function() {
    it('should append the location query string to the request URL', function() {
      let wrapper = this.wrapper;
      wrapper.instance().fetchData();

      let apiArgs = this.stubbedApiRequest.lastCall.args;
      expect(apiArgs[0]).toEqual('/projects/123/456/releases/abcdef/files/');
      expect(apiArgs[1].data).toHaveProperty('cursor', '0:0:100');
    });
  });
});
