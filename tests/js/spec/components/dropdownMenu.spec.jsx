import React from 'react';

import {mount} from 'sentry-test/enzyme';

import DropdownMenu from 'app/components/dropdownMenu';

jest.useFakeTimers();

describe('DropdownMenu', function() {
  let wrapper;

  beforeEach(function() {
    wrapper = mount(
      <DropdownMenu>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => (
          <span {...getRootProps({})}>
            <button {...getActorProps({})}>Open Dropdown</button>
            {isOpen && (
              <ul {...getMenuProps({})}>
                <li>Dropdown Menu Item 1</li>
              </ul>
            )}
          </span>
        )}
      </DropdownMenu>
    );
  });

  it('renders', function() {
    expect(wrapper).toSnapshot();
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

  it('closes dropdown when clicking outside of menu', async function() {
    wrapper.find('button').simulate('click');
    // Simulate click on document
    const evt = document.createEvent('HTMLEvents');
    evt.initEvent('click', false, true);
    document.body.dispatchEvent(evt);
    jest.runAllTimers();
    await Promise.resolve();
    wrapper.update();

    expect(wrapper.find('ul')).toHaveLength(0);
  });

  it('closes dropdown when pressing escape', function() {
    wrapper.find('button').simulate('click');
    expect(wrapper.state('isOpen')).toBe(true);
    wrapper.simulate('keyDown', {key: 'Escape'});
    wrapper.find('button').simulate('keyDown', {key: 'Escape'});
    expect(wrapper.state('isOpen')).toBe(false);
    expect(wrapper.find('ul')).toHaveLength(0);
  });

  it('ignores "Escape" key if `closeOnEscape` is false', function() {
    wrapper = mount(
      <DropdownMenu closeOnEscape={false}>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => (
          <span {...getRootProps({})}>
            <button {...getActorProps({})}>Open Dropdown</button>
            {isOpen && (
              <ul {...getMenuProps({})}>
                <li>Dropdown Menu Item 1</li>
              </ul>
            )}
          </span>
        )}
      </DropdownMenu>
    );

    wrapper.find('button').simulate('click');
    expect(wrapper.state('isOpen')).toBe(true);
    wrapper.find('button').simulate('keyDown', {key: 'Escape'});
    expect(wrapper.find('ul')).toHaveLength(1);
    expect(wrapper.state('isOpen')).toBe(true);
  });

  it('keeps dropdown open when clicking on anything in menu with `keepMenuOpen` prop', function() {
    wrapper = mount(
      <DropdownMenu keepMenuOpen>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => (
          <span {...getRootProps({})}>
            <button {...getActorProps({})}>Open Dropdown</button>
            {isOpen && (
              <ul {...getMenuProps({})}>
                <li>Dropdown Menu Item 1</li>
              </ul>
            )}
          </span>
        )}
      </DropdownMenu>
    );

    wrapper.find('button').simulate('click');
    wrapper.find('li').simulate('click');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.find('ul')).toHaveLength(1);
  });

  it('render prop getters all extend props and call original onClick handlers', function() {
    const rootClick = jest.fn();
    const actorClick = jest.fn();
    const menuClick = jest.fn();
    const addSpy = jest.spyOn(document, 'addEventListener');
    const removeSpy = jest.spyOn(document, 'removeEventListener');

    wrapper = mount(
      <DropdownMenu keepMenuOpen>
        {({getRootProps, getActorProps, getMenuProps, isOpen}) => (
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
        )}
      </DropdownMenu>
    );

    expect(wrapper.find('ul')).toHaveLength(0);

    wrapper.find('span').simulate('click');
    expect(rootClick).toHaveBeenCalled();
    wrapper.find('button').simulate('click');
    expect(actorClick).toHaveBeenCalled();
    wrapper.find('li').simulate('click');
    expect(menuClick).toHaveBeenCalled();

    // breaks in jest22
    // expect(wrapper).toSnapshot();
    expect(wrapper.find('ul')).toHaveLength(1);
    expect(document.addEventListener).toHaveBeenCalled();

    wrapper.unmount();
    expect(document.removeEventListener).toHaveBeenCalled();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('always rendered menus should attach document event listeners only when opened', function() {
    const addSpy = jest.spyOn(document, 'addEventListener');
    const removeSpy = jest.spyOn(document, 'removeEventListener');

    wrapper = mount(
      <DropdownMenu alwaysRenderMenu>
        {({getRootProps, getActorProps, getMenuProps}) => (
          <span
            {...getRootProps({
              className: 'root',
            })}
          >
            <button
              {...getActorProps({
                className: 'actor',
              })}
            >
              Open Dropdown
            </button>
            <ul
              {...getMenuProps({
                className: 'menu',
              })}
            >
              <li>Dropdown Menu Item 1</li>
            </ul>
          </span>
        )}
      </DropdownMenu>
    );

    // Make sure this is only called when menu is open
    expect(document.addEventListener).not.toHaveBeenCalled();
    wrapper.find('button').simulate('click');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(document.addEventListener).toHaveBeenCalled();

    expect(document.removeEventListener).not.toHaveBeenCalled();
    wrapper.find('button').simulate('click');
    expect(wrapper.state('isOpen')).toBe(false);
    expect(document.removeEventListener).toHaveBeenCalled();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('does not close nested dropdown on actor clicks', function() {
    wrapper = mount(
      <DropdownMenu isNestedDropdown>
        {({getRootProps, getActorProps, getMenuProps}) => (
          <span {...getRootProps({})}>
            <button {...getActorProps({})}>Open Dropdown</button>
            {
              <ul {...getMenuProps({})}>
                <li data-test-id="menu-item">Dropdown Menu Item 1</li>
              </ul>
            }
          </span>
        )}
      </DropdownMenu>
    );
    wrapper.find('button').simulate('mouseEnter');
    expect(wrapper.find('[data-test-id="menu-item"]')).toHaveLength(1);

    wrapper.find('button').simulate('click');
    //Should still be visible.
    expect(wrapper.find('[data-test-id="menu-item"]')).toHaveLength(1);
  });
});
