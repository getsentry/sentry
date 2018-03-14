import React from 'react';
import {mount} from 'enzyme';

import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';

jest.useFakeTimers();

const CLOSE_DELAY = 0;

describe('Settings Breadcrumb Dropdown', function() {
  let wrapper;
  let selectMock = jest.fn();
  let items = [{value: '1', label: 'foo'}, {value: '2', label: 'bar'}];

  beforeEach(function() {
    wrapper = mount(
      <BreadcrumbDropdown items={items} name="Test" hasMenu onSelect={selectMock} />
    );
  });

  it('opens when hovered over crumb', function() {
    wrapper.find('Crumb').simulate('mouseEnter');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(2);
  });

  it('closes after 200ms when mouse leaves crumb', function() {
    wrapper.find('Crumb').simulate('mouseEnter');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(1);

    wrapper.find('Crumb').simulate('mouseLeave');
    // wonder what happens when this arg is negative o_O
    jest.advanceTimersByTime(CLOSE_DELAY - 10);
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(1);
    jest.advanceTimersByTime(10);
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(0);
  });

  it('closes immediately after selecting an item', function() {
    wrapper.find('Crumb').simulate('mouseEnter');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(1);

    wrapper
      .find('AutoCompleteItem')
      .first()
      .simulate('click');
    expect(wrapper.find('StyledMenu')).toHaveLength(0);
  });

  it('stays open when hovered over crumb and then into dropdown menu', function() {
    wrapper.find('Crumb').simulate('mouseEnter');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(1);

    wrapper.find('Crumb').simulate('mouseLeave');
    wrapper.find('StyledMenu').simulate('mouseEnter');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(1);
  });

  it('closes after entering dropdown and then leaving dropdown', function() {
    wrapper.find('Crumb').simulate('mouseEnter');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(1);

    wrapper.find('Crumb').simulate('mouseLeave');
    wrapper.find('StyledMenu').simulate('mouseEnter');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(1);

    wrapper.find('StyledMenu').simulate('mouseLeave');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('StyledMenu')).toHaveLength(0);
  });
});
