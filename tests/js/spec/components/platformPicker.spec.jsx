import React from 'react';

import {shallow, mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import PlatformPicker from 'app/components/platformPicker';

describe('PlatformPicker', function () {
  beforeEach(function () {
    this.stubbedApiRequest = jest.spyOn(Client.prototype, 'request');
  });

  afterEach(function () {
    Client.prototype.request.mockRestore();
  });

  describe('render()', function () {
    const baseProps = {
      platform: '',
      setPlatform: () => {},
      location: {query: {}},
    };

    it('should only render Mobile platforms under Mobile tab', function () {
      const props = {
        ...baseProps,
      };

      const wrapper = shallow(<PlatformPicker {...props} />);
      wrapper.setState({category: 'mobile'});
      const filteredPlatforms = wrapper
        .find('PlatformCard')
        .map(node => node.prop('platform').id);

      expect(filteredPlatforms).not.toContain('java');
      expect(filteredPlatforms).toContain('cocoa-swift');
      expect(filteredPlatforms).toContain('react-native');
      expect(filteredPlatforms).toContain('cocoa-objc');
      expect(filteredPlatforms).toContain('java-android');
      expect(filteredPlatforms).toContain('cordova');
    });

    it('should render renderPlatformList with Python when filtered with py', function () {
      const props = {
        ...baseProps,
      };

      const wrapper = shallow(<PlatformPicker {...props} />);

      wrapper.setState({category: 'all', filter: 'py'});

      const filteredPlatforms = wrapper
        .find('PlatformCard')
        .map(node => node.prop('platform').id);
      expect(filteredPlatforms).not.toContain('java');
      expect(filteredPlatforms).toContain('python-flask');
    });

    it('should render renderPlatformList with community SDKs message if platform not found', function () {
      const props = {
        ...baseProps,
      };

      const wrapper = shallow(<PlatformPicker {...props} />);
      wrapper.setState({filter: 'aaaaaa'});

      expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    });

    it('should update State.tab onClick when particular tab is clicked', function () {
      const props = {
        ...baseProps,
      };

      const wrapper = mountWithTheme(
        <PlatformPicker {...props} />,
        TestStubs.routerContext()
      );

      const testListLink = wrapper.find('ListLink').last().find('a');
      expect(wrapper.state().category).toBe('popular');

      testListLink.simulate('click');
      expect(wrapper.state().category).toBe('all');
    });

    it('should clear the platform when clear is clicked', function () {
      const props = {
        ...baseProps,
        platform: 'java',
        setPlatform: jest.fn(),
      };

      const wrapper = mountWithTheme(
        <PlatformPicker {...props} />,
        TestStubs.routerContext()
      );

      wrapper.find('ClearButton').simulate('click');
      expect(props.setPlatform).toHaveBeenCalledWith('');
    });
  });
});
