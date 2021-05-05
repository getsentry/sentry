import {mountWithTheme} from 'sentry-test/enzyme';

import DropdownAutoComplete from 'app/components/dropdownAutoComplete';

describe('DropdownAutoComplete', function () {
  const routerContext = TestStubs.routerContext();
  const items = [
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
  ];

  it('has actor wrapper', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoComplete items={items}>{() => 'Click Me!'}</DropdownAutoComplete>,
      routerContext
    );
    expect(wrapper.find('div[role="button"]')).toHaveLength(1);
    expect(wrapper.find('div[role="button"]').text()).toBe('Click Me!');
  });

  it('opens dropdown menu when actor is clicked', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoComplete items={items}>{() => 'Click Me!'}</DropdownAutoComplete>,
      routerContext
    );
    wrapper.find('Actor[role="button"]').simulate('click');
    expect(wrapper.find('BubbleWithMinWidth')).toHaveLength(1);

    wrapper.find('Actor[role="button"]').simulate('click');
    expect(wrapper.find('BubbleWithMinWidth')).toHaveLength(1);
  });

  it('toggles dropdown menu when actor is clicked', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoComplete allowActorToggle items={items}>
        {() => 'Click Me!'}
      </DropdownAutoComplete>,
      routerContext
    );
    wrapper.find('Actor[role="button"]').simulate('click');
    expect(wrapper.find('BubbleWithMinWidth')).toHaveLength(1);
    wrapper.find('Actor[role="button"]').simulate('click');
    expect(wrapper.find('BubbleWithMinWidth')).toHaveLength(0);
  });
});
