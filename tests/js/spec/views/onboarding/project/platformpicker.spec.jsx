import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import {Client} from 'app/api';
import PlatformPicker from 'app/views/onboarding/project/platformpicker';
import {categoryLists} from 'app/views/onboarding/utils';
import sinon from 'sinon';

describe('PlatformPicker', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
      location: {query: {}},
      params: {
        setPlatform: '',
        platform: '',
        isActive: ''
      }
    };

    it('should only render Mobile platforms under Mobile tab', function() {
      let props = {
        ...baseProps
      };

      let wrapper = shallow(<PlatformPicker {...props} />);
      expect(toJson(wrapper)).toMatchSnapshot();
      wrapper.setState({tab: 'Mobile'});
      let filteredPlatforms = wrapper
        .find('PlatformCard')
        .map(node => node.prop('platform'));

      expect(filteredPlatforms).not.toContain('java');
      expect(filteredPlatforms).toContain(categoryLists.Mobile[0]);
    });

    it('should render renderPlatformList with Python when filtered with P', function() {
      let props = {
        ...baseProps
      };

      let wrapper = shallow(<PlatformPicker {...props} />);
      expect(toJson(wrapper)).toMatchSnapshot();
      wrapper.setState({tab: 'All', filter: 'p'});
      let filteredPlatforms = wrapper
        .find('PlatformCard')
        .map(node => node.prop('platform'));
      expect(filteredPlatforms).not.toContain('java');
      expect(filteredPlatforms).toContain('python-flask');
    });

    it('should render renderPlatformList with community SDKs message if platform not found', function() {
      let props = {
        ...baseProps
      };

      let wrapper = shallow(<PlatformPicker {...props} />);
      expect(toJson(wrapper)).toMatchSnapshot();
      wrapper.setState({filter: 'aaaaaa'});
      expect(wrapper.text()).toContain('Not finding your platform?');
    });
  });
});
