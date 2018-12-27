import React from 'react';
import {mount} from 'enzyme';

import DropdownAutoComplete from 'app/components/dropdownAutoComplete';

describe('DropdownAutoComplete', function() {
  const routerContext = TestStubs.routerContext();

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
      </DropdownAutoComplete>,
      routerContext
    );
    expect(wrapper.find('div[role="button"]')).toHaveLength(1);
    expect(wrapper.find('div[role="button"]').text()).toBe('Click Me!');
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
      </DropdownAutoComplete>,
      routerContext
    );
    wrapper.find('Actor[role="button"]').simulate('click');
    expect(wrapper.find('StyledMenu')).toHaveLength(1);
  });
});
