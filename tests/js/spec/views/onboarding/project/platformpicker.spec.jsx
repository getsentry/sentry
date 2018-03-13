import PropTypes from 'prop-types';
import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import PlatformPicker from 'app/views/onboarding/project/platformpicker';
import sinon from 'sinon';

describe('PlatformPicker', function() {
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
      platform: '',
      setPlatform: () => {},
      location: {query: {}},
    };

    it('should only render Mobile platforms under Mobile tab', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = shallow(<PlatformPicker {...props} />);
      wrapper.setState({tab: 'mobile'});
      let filteredPlatforms = wrapper
        .find('PlatformCard')
        .map(node => node.prop('platform'));

      expect(filteredPlatforms).not.toContain('java');
      expect(filteredPlatforms).toContain('swift');

      expect(wrapper).toMatchSnapshot();
    });

    it('should render renderPlatformList with Python when filtered with py', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = shallow(<PlatformPicker {...props} />);

      wrapper.setState({tab: 'all', filter: 'py'});

      let filteredPlatforms = wrapper
        .find('PlatformCard')
        .map(node => node.prop('platform'));
      expect(filteredPlatforms).not.toContain('java');
      expect(filteredPlatforms).toContain('python-flask');

      expect(wrapper).toMatchSnapshot();
    });

    it('should render renderPlatformList with community SDKs message if platform not found', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = shallow(<PlatformPicker {...props} />);
      wrapper.setState({filter: 'aaaaaa'});

      expect(wrapper.text()).toContain('Not finding your platform?');

      expect(wrapper).toMatchSnapshot();
    });

    it('should update State.tab onClick when particular tab is clicked', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = mount(<PlatformPicker {...props} />, {
        context: {
          router: TestStubs.router(),
        },
        childContextTypes: {
          router: PropTypes.object,
        },
      });

      let testListLink = wrapper
        .find('ListLink')
        .last()
        .find('a');
      expect(wrapper.state().tab).toBe('popular');
      expect(wrapper.state().tab).not.toBe('all');

      testListLink.simulate('click');

      expect(wrapper.state().tab).not.toBe('popular');
      expect(wrapper.state().tab).toBe('all');

      expect(wrapper).toMatchSnapshot();
    });
  });
});
