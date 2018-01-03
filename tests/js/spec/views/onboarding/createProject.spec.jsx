import PropTypes from 'prop-types';
import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import CreateProject from 'app/views/onboarding/createProject';

describe('CreateProject', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    this.stubbedApiRequest = sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
      location: {query: {}},
      params: {
        projectId: '',
        orgId: 'testOrg',
      },
    };

    it('should block if you have access to no teams', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = shallow(<CreateProject {...props} />, {
        context: {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: false}],
          },
          location: {query: {}},
        },
        childContextTypes: {
          organization: PropTypes.object,
          location: PropTypes.object,
        },
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('should fill in project name if its empty when platform is chosen', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = mount(<CreateProject {...props} />, {
        context: {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          router: TestStubs.router(),
          location: {query: {}},
        },
        childContextTypes: {
          router: PropTypes.object,
          organization: PropTypes.object,
          location: PropTypes.object,
        },
      });

      let node = wrapper.find('PlatformCard').first();
      node.props().onClick();
      expect(wrapper.state().projectName).toBe('C#');

      node = wrapper.find('PlatformCard').last();
      node.props().onClick();
      expect(wrapper.state().projectName).toBe('Ruby');

      //but not replace it when project name is something else:
      wrapper.setState({projectName: 'another'});

      node = wrapper.find('PlatformCard').first();
      node.props().onClick();
      expect(wrapper.state().projectName).toBe('another');

      expect(wrapper).toMatchSnapshot();
    });

    it('should fill in platform name if its provided by url', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = mount(<CreateProject {...props} />, {
        context: {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          router: TestStubs.router(),
          location: {query: {platform: 'ruby'}},
        },
        childContextTypes: {
          router: PropTypes.object,
          organization: PropTypes.object,
          location: PropTypes.object,
        },
      });

      expect(wrapper.state().projectName).toBe('Ruby');

      expect(wrapper).toMatchSnapshot();
    });

    it('should deal with incorrect platform name if its provided by url', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = mount(<CreateProject {...props} />, {
        context: {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          router: TestStubs.router(),
          location: {query: {platform: 'XrubyROOLs'}},
        },
        childContextTypes: {
          router: PropTypes.object,
          organization: PropTypes.object,
          location: PropTypes.object,
        },
      });

      expect(wrapper.state().projectName).toBe('');

      expect(wrapper).toMatchSnapshot();
    });
  });
});
