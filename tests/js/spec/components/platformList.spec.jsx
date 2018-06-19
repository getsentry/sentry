import React from 'react';
import {mount} from 'enzyme';
import PlatformList from 'app/components/platformList';

describe('PlatformList', function() {
  it('renders max of three icons from platforms', function() {
    const platforms = ['java', 'php', 'javascript', 'cocoa', 'ruby'];
    const wrapper = mount(<PlatformList platforms={platforms} />);
    const icons = wrapper.find('StyledPlatformIcon');
    expect(icons).toHaveLength(3);
  });

  it('handles no platforms', function() {
    const platforms = [];
    const wrapper = mount(<PlatformList platforms={platforms} />);
    const icons = wrapper.find('StyledPlatformIcon');
    expect(icons).toHaveLength(1);
  });
});
