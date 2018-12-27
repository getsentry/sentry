import React from 'react';
import {shallow} from 'enzyme';
import PluginIcon from 'app/plugins/components/pluginIcon';

// For some reason jest only respects the last mocked, so we can't test
// two different images here
// jest.mock('images/integrations/integration-default.png', () => 'default', {});
jest.mock('images/integrations/github-logo.png', () => 'github', {});

describe('PluginIcon', function() {
  it('renders', function() {
    let wrapper = shallow(<PluginIcon pluginId="github" size={20} />);
    expect(wrapper).toMatchSnapshot();
  });

  // doesn't work because of the above comment
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('renders with default icon with invalid plugin id', function() {
    let wrapper = shallow(<PluginIcon pluginId="invalid" size={20} />);
    expect(wrapper).toMatchSnapshot();
  });
});
