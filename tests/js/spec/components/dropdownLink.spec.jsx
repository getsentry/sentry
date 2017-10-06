import React from 'react';
import TestUtils from 'react-addons-test-utils';
import {shallow} from 'enzyme';
import DropdownLink from 'app/components/dropdownLink';

describe('DropdownLink', function() {
  const INPUT_1 = {
    title: 'test',
    onOpen: () => {},
    onClose: () => {},
    topLevelClasses: 'top-level-class',
    menuClasses: ''
  };

  describe('componentWillUnmount()', function() {
    it('should remove event handlers before unmounting', function() {
      let dropdownlink = TestUtils.renderIntoDocument(<DropdownLink {...INPUT_1} />);

      let handlers = jQuery._data(dropdownlink.refs.dropdownToggle.parentNode, 'events');
      expect(handlers).toBeInstanceOf(Object);

      dropdownlink.componentWillUnmount(dropdownlink);

      handlers = jQuery._data(dropdownlink.refs.dropdownToggle.parentNode, 'events');
      expect(handlers).toBe(undefined);
    });
  });

  it('renders and anchors to left by default', function() {
    let component = shallow(
      <DropdownLink {...INPUT_1}>
        <div>1</div>
        <div>2</div>
      </DropdownLink>
    );

    expect(component).toMatchSnapshot();
  });

  it('renders and anchors to right', function() {
    let component = shallow(
      <DropdownLink {...INPUT_1} anchorRight>
        <div>1</div>
        <div>2</div>
      </DropdownLink>
    );

    expect(component).toMatchSnapshot();
  });
});
