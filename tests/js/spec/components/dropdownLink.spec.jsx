import $ from 'jquery';
import React from 'react';

import {mount} from 'sentry-test/enzyme';

import DropdownLink from 'app/components/dropdownLink';
import {MENU_CLOSE_DELAY} from 'app/constants';

jest.useFakeTimers();

describe('DropdownLink', function() {
  const INPUT_1 = {
    title: 'test',
    onOpen: () => {},
    onClose: () => {},
    topLevelClasses: 'top-level-class',
    alwaysRenderMenu: true,
    menuClasses: '',
  };

  describe('renders', function() {
    it('and anchors to left by default', function() {
      const component = mount(
        <DropdownLink {...INPUT_1}>
          <div>1</div>
          <div>2</div>
        </DropdownLink>
      );

      expect(component).toSnapshot();
    });

    it('and anchors to right', function() {
      const component = mount(
        <DropdownLink {...INPUT_1} anchorRight>
          <div>1</div>
          <div>2</div>
        </DropdownLink>
      );

      expect(component).toSnapshot();
    });
  });

  describe('Uncontrolled', function() {
    let wrapper;

    beforeEach(function() {
      if (wrapper) {
        wrapper.unmount();
      }

      wrapper = mount(
        <DropdownLink alwaysRenderMenu={false} title="test">
          <li>hi</li>
        </DropdownLink>
      );
    });

    describe('While Closed', function() {
      it('displays dropdown menu when dropdown actor button clicked', function() {
        expect(wrapper.find('li')).toHaveLength(0);

        // open
        wrapper.find('a').simulate('click');
        expect(wrapper.find('li')).toHaveLength(1);
      });
    });
    describe('While Opened', function() {
      beforeEach(function() {
        // Opens dropdown menu
        wrapper.find('a').simulate('click');
      });

      it('closes when clicked outside', async function() {
        const evt = document.createEvent('HTMLEvents');
        evt.initEvent('click', false, true);
        document.body.dispatchEvent(evt);
        jest.runAllTimers();
        await Promise.resolve();
        wrapper.update();
        expect(wrapper.find('li')).toHaveLength(0);
      });

      it('closes when dropdown actor button is clicked', function() {
        wrapper.find('a').simulate('click');
        expect(wrapper.find('li')).toHaveLength(0);
      });

      it('closes when dropdown menu item is clicked', function() {
        wrapper.find('li').simulate('click');
        expect(wrapper.find('li')).toHaveLength(0);
      });

      it('does not close when menu is clicked and `keepMenuOpen` is on', function() {
        wrapper = mount(
          <DropdownLink title="test" alwaysRenderMenu={false} keepMenuOpen>
            <li>hi</li>
          </DropdownLink>
        );
        wrapper.find('a').simulate('click');
        wrapper.find('li').simulate('click');
        expect(wrapper.find('li')).toHaveLength(1);
        wrapper.unmount();
      });
    });
  });

  describe('Controlled', function() {
    let wrapper;

    beforeEach(function() {
      if (wrapper) {
        wrapper.unmount();
      }
    });
    describe('Opened', function() {
      beforeEach(function() {
        wrapper = mount(
          <DropdownLink isOpen alwaysRenderMenu={false} title="test">
            <li>hi</li>
          </DropdownLink>
        );
      });

      it('does not close when menu is clicked', function() {
        // open
        wrapper.find('li').simulate('click');
        // State does not change
        expect(wrapper.find('.dropdown-menu')).toHaveLength(1);
      });

      it('does not close when document is clicked', function() {
        $(document).click();
        // State does not change
        expect(wrapper.find('.dropdown-menu')).toHaveLength(1);
      });

      it('does not close when dropdown actor is clicked', function() {
        wrapper.find('a').simulate('click');
        // State does not change
        expect(wrapper.find('.dropdown-menu')).toHaveLength(1);
      });
    });
    describe('Closed', function() {
      beforeEach(function() {
        wrapper = mount(
          <DropdownLink isOpen={false} alwaysRenderMenu={false} title="test">
            <li>hi</li>
          </DropdownLink>
        );
      });

      it('does not open when dropdown actor is clicked', function() {
        wrapper.find('a').simulate('click');
        // State does not change
        expect(wrapper.find('.dropdown-menu')).toHaveLength(0);
      });
    });
  });

  describe('Nested Dropdown', function() {
    let wrapper;

    beforeEach(function() {
      if (wrapper) {
        wrapper.unmount();
      }

      wrapper = mount(
        <DropdownLink title="parent" alwaysRenderMenu={false}>
          <li id="nested-actor">
            <DropdownLink
              className="nested-menu"
              alwaysRenderMenu={false}
              title="nested"
              isNestedDropdown
            >
              <li id="nested-actor-2">
                <DropdownLink
                  className="nested-menu-2"
                  alwaysRenderMenu={false}
                  title="nested #2"
                  isNestedDropdown
                >
                  <li id="nested-actor-3">Hello</li>
                </DropdownLink>
              </li>
            </DropdownLink>
          </li>
          <li id="no-nest">Item 2</li>
        </DropdownLink>
      );

      // Start when menu open
      wrapper.find('a').simulate('click');
    });

    it('closes when top-level actor is clicked', function() {
      wrapper
        .find('a')
        .first()
        .simulate('click');
      expect(wrapper.find('.dropdown-menu')).toHaveLength(0);
    });

    it('Opens / closes on mouse enter and leave', function() {
      // Nested menus have delay on open
      wrapper.find('.dropdown-menu a').simulate('mouseEnter');
      jest.runAllTimers();
      wrapper.update();
      expect(wrapper.find('.dropdown-menu')).toHaveLength(2);

      // Leaving Nested Menu
      wrapper.find('a.nested-menu').simulate('mouseLeave');

      // Nested menus have close delay
      expect(wrapper.find('.dropdown-menu')).toHaveLength(2);
      jest.advanceTimersByTime(MENU_CLOSE_DELAY - 1);
      wrapper.update();

      // Re-entering nested menu will cancel close
      expect(wrapper.find('.dropdown-menu')).toHaveLength(2);
      wrapper.find('a.nested-menu').simulate('mouseEnter');
      jest.advanceTimersByTime(2);
      wrapper.update();
      expect(wrapper.find('.dropdown-menu')).toHaveLength(2);

      // Re-entering an actor will also cancel close
      expect(wrapper.find('.dropdown-menu')).toHaveLength(2);
      jest.advanceTimersByTime(MENU_CLOSE_DELAY - 1);
      wrapper.update();
      wrapper
        .find('.dropdown-menu a')
        .first()
        .simulate('mouseEnter');
      jest.advanceTimersByTime(2);
      wrapper.update();
      expect(wrapper.find('.dropdown-menu')).toHaveLength(2);

      // Leave menu
      wrapper.find('a.nested-menu').simulate('mouseLeave');
      jest.runAllTimers();
      wrapper.update();
      expect(wrapper.find('.dropdown-menu')).toHaveLength(1);
    });

    it('closes when first level nested actor is clicked', function() {
      wrapper.find('#nested-actor').simulate('click');
      expect(wrapper.find('.dropdown-menu')).toHaveLength(0);
    });

    it('does not close when second level nested actor is clicked', function() {
      wrapper.find('a.nested-menu').simulate('mouseEnter');
      jest.runAllTimers();
      wrapper.update();
      wrapper.find('a.nested-menu-2 span').simulate('click');
      expect(wrapper.find('.dropdown-menu')).toHaveLength(2);
    });

    it('closes when third level nested actor is clicked', function() {
      wrapper.find('a.nested-menu').simulate('mouseEnter');
      jest.runAllTimers();
      wrapper.update();
      wrapper.find('a.nested-menu-2').simulate('mouseEnter');
      jest.runAllTimers();
      wrapper.update();
      wrapper.find('#nested-actor-3').simulate('click');
      expect(wrapper.find('.dropdown-menu')).toHaveLength(0);
    });
  });
});
