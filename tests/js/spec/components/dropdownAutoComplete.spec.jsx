import React from 'react';
import {mount} from 'enzyme';

import DropdownAutoComplete from 'app/components/dropdownAutoComplete';

describe('DropdownAutoComplete', function() {
  it('has actor wrapper', function() {
    const wrapper = mount(
      <DropdownAutoComplete
        items={[
          {
            value: 'apple',
            label: <div>Apple</div>,
          },
          {
            value: 'bacon',
            label: <div>Bacon</div>,
          },
          {
            value: 'corn',
            label: <div>Corn</div>,
          },
        ]}
      >
        {() => 'Click Me!'}
      </DropdownAutoComplete>
    );
    expect(wrapper.find('[role="button"]')).toHaveLength(1);
    expect(wrapper.find('[role="button"]').text()).toBe('Click Me!');
  });

  it('opens dropdown menu when actor is clicked', function() {
    const wrapper = mount(
      <DropdownAutoComplete
        items={[
          {
            value: 'apple',
            label: <div>Apple</div>,
          },
          {
            value: 'bacon',
            label: <div>Bacon</div>,
          },
          {
            value: 'corn',
            label: <div>Corn</div>,
          },
        ]}
      >
        {() => 'Click Me!'}
      </DropdownAutoComplete>
    );
    wrapper.find('[role="button"]').simulate('click');
    expect(wrapper.find('StyledMenu')).toHaveLength(1);
  });
});
