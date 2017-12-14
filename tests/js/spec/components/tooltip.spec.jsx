import React from 'react';
import {mount} from 'enzyme';
import Tooltip from 'app/components/tooltip';

describe('Tooltip', function() {
  it('renders', function() {
    let wrapper = mount(
      <Tooltip title="test">
        <span>My Button</span>
      </Tooltip>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
