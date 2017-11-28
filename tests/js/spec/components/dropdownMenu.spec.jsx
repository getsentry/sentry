import React from 'react';
import {mount} from 'enzyme';
import DropdownMenu from 'app/components/dropdownMenu';

describe('DropdownMenu', function() {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(
      <DropdownMenu>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => {
          return (
            <span {...getRootProps({})}>
              <button {...getActorProps({})}>Open Dropdown</button>
              {isOpen && (
                <ul {...getMenuProps({})}>
                  <li>Dropdown Menu Item 1</li>
                </ul>
              )}
            </span>
          );
        }}
      </DropdownMenu>
    );
  });

  it('renders', function() {
    expect(wrapper).toMatchSnapshot();
  });

  it('can toggle dropdown menu with actor', function() {
    wrapper.find('button').simulate('click');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.find('ul')).toHaveLength(1);
    wrapper.find('button').simulate('click');
    expect(wrapper.state('isOpen')).toBe(false);
    expect(wrapper.find('ul')).toHaveLength(0);
  });

  it('closes dropdown when clicking on anything in menu', function() {
    wrapper.find('button').simulate('click');
    wrapper.find('li').simulate('click');
    expect(wrapper.state('isOpen')).toBe(false);
    expect(wrapper.find('ul')).toHaveLength(0);
  });

  it('closes dropdown when clicking outside of menu', function() {
    wrapper.find('button').simulate('click');
    // Simulate click on document
    const evt = document.createEvent('HTMLEvents');
    evt.initEvent('click', false, true);
    document.body.dispatchEvent(evt);

    expect(wrapper.find('ul')).toHaveLength(0);
  });

  it('keeps dropdown open when clicking on anything in menu with `keepMenuOpen` prop', function() {
    wrapper = mount(
      <DropdownMenu keepMenuOpen>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => {
          return (
            <span {...getRootProps({})}>
              <button {...getActorProps({})}>Open Dropdown</button>
              {isOpen && (
                <ul {...getMenuProps({})}>
                  <li>Dropdown Menu Item 1</li>
                </ul>
              )}
            </span>
          );
        }}
      </DropdownMenu>
    );

    wrapper.find('button').simulate('click');
    wrapper.find('li').simulate('click');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.find('ul')).toHaveLength(1);
  });

  it('render prop getters all extend props and call original onClick handlers', function() {
    let rootClick = jest.fn();
    let actorClick = jest.fn();
    let menuClick = jest.fn();

    wrapper = mount(
      <DropdownMenu keepMenuOpen>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => {
          return (
            <span
              {...getRootProps({
                className: 'root',
                onClick: rootClick,
              })}
            >
              <button
                {...getActorProps({
                  className: 'actor',
                  onClick: actorClick,
                })}
              >
                Open Dropdown
              </button>
              {isOpen && (
                <ul
                  {...getMenuProps({
                    className: 'menu',
                    onClick: menuClick,
                  })}
                >
                  <li>Dropdown Menu Item 1</li>
                </ul>
              )}
            </span>
          );
        }}
      </DropdownMenu>
    );

    print(wrapper.find('button'));
    wrapper.find('span').simulate('click');
    expect(rootClick).toHaveBeenCalled();
    wrapper.find('button').simulate('click');
    expect(actorClick).toHaveBeenCalled();
    wrapper.find('li').simulate('click');
    expect(menuClick).toHaveBeenCalled();

    expect(wrapper).toMatchSnapshot();
  });
});
