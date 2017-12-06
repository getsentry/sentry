import React from 'react';
import {mount} from 'enzyme';
import DropdownLink from 'app/components/dropdownLink';

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
      let component = mount(
        <DropdownLink {...INPUT_1}>
          <div>1</div>
          <div>2</div>
        </DropdownLink>
      );

      expect(component).toMatchSnapshot();
    });

    it('and anchors to right', function() {
      let component = mount(
        <DropdownLink {...INPUT_1} anchorRight>
          <div>1</div>
          <div>2</div>
        </DropdownLink>
      );

      expect(component).toMatchSnapshot();
    });
  });

  describe('Uncontrolled', function() {
    let wrapper;

    beforeEach(function() {
      if (wrapper) {
        wrapper.unmount();
      }

      wrapper = mount(
        <DropdownLink title="test">
          <li>hi</li>
        </DropdownLink>
      );
    });

    describe('While Closed', function() {
      it('displays dropdown menu when dropdown actor button clicked', function() {
        expect(wrapper.find('li')).toHaveLength(0);

        // open
        wrapper.find('a').simulate('click');
        expect(wrapper.find('li').length).toBe(1);
      });
    });
    describe('While Opened', function() {
      beforeEach(function() {
        // Opens dropdown menu
        wrapper.find('a').simulate('click');
      });

      it('closes when clicked outside', function() {
        const evt = document.createEvent('HTMLEvents');
        evt.initEvent('click', false, true);
        document.body.dispatchEvent(evt);
        expect(wrapper.find('li').length).toBe(0);
      });

      it('closes when dropdown actor button is clicked', function() {
        wrapper.find('a').simulate('click');
        expect(wrapper.find('li').length).toBe(0);
      });

      it('closes when dropdown menu item is clicked', function() {
        wrapper.find('li').simulate('click');
        expect(wrapper.find('li').length).toBe(0);
      });

      it('does not close when menu is clicked and `keepMenuOpen` is on', function() {
        wrapper = mount(
          <DropdownLink title="test" keepMenuOpen>
            <li>hi</li>
          </DropdownLink>
        );
        wrapper.find('a').simulate('click');
        wrapper.find('li').simulate('click');
        expect(wrapper.find('li').length).toBe(1);
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
          <DropdownLink isOpen={true} title="test">
            <li>hi</li>
          </DropdownLink>
        );
      });

      it('does not close when menu is clicked', function() {
        // open
        wrapper.find('li').simulate('click');
        // State does not change
        expect(wrapper.find('.dropdown-menu').length).toBe(1);
      });

      it('does not close when document is clicked', function() {
        jQuery(document).click();
        // State does not change
        expect(wrapper.find('.dropdown-menu').length).toBe(1);
      });

      it('does not close when dropdown actor is clicked', function() {
        wrapper.find('a').simulate('click');
        // State does not change
        expect(wrapper.find('.dropdown-menu').length).toBe(1);
      });
    });
    describe('Closed', function() {
      beforeEach(function() {
        wrapper = mount(
          <DropdownLink isOpen={false} title="test">
            <li>hi</li>
          </DropdownLink>
        );
      });

      it('does not open when dropdown actor is clicked', function() {
        wrapper.find('a').simulate('click');
        // State does not change
        expect(wrapper.find('.dropdown-menu').length).toBe(0);
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
        <DropdownLink title="parent">
          <li id="nested-actor">
            <DropdownLink className="nested-menu" title="nested" isNestedDropdown={true}>
              <li id="nested-actor-2">
                <DropdownLink
                  className="nested-menu-2"
                  title="nested #2"
                  isNestedDropdown={true}
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
      wrapper.find('.dropdown-menu a').simulate('mouseEnter');
      expect(wrapper.find('.dropdown-menu').length).toBe(2);

      wrapper.find('.nested-menu').simulate('mouseLeave');

      expect(wrapper.find('.dropdown-menu').length).toBe(1);
    });

    it('closes when first level nested actor is clicked', function() {
      wrapper.find('#nested-actor').simulate('click');
      expect(wrapper.find('.dropdown-menu')).toHaveLength(0);
    });

    it('closes when second level nested actor is clicked', function() {
      wrapper.find('.nested-menu').simulate('mouseEnter');
      wrapper.find('.nested-menu-2 span').simulate('click');
      expect(wrapper.find('.dropdown-menu')).toHaveLength(0);
    });

    it('closes when third level nested actor is clicked', function() {
      wrapper.find('.nested-menu').simulate('mouseEnter');
      wrapper.find('.nested-menu-2').simulate('mouseEnter');
      wrapper.find('#nested-actor-3').simulate('click');
      expect(wrapper.find('.dropdown-menu')).toHaveLength(0);
    });
  });
});
