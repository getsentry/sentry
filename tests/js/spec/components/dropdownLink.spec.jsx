import React from 'react';
import TestUtils from 'react-addons-test-utils';
import DropdownLink from 'app/components/dropdownLink';

describe('DropdownLink', function() {
  const INPUT_1 = {
    title: 'test',
    onOpen: ()=>{},
    onClose: ()=>{},
    topLevelClasses: 'React.PropTypes.string',
    menuClasses: ''
  };


  describe('componentWillUnmount()', function() {
    it('should remove event handlers before unmounting', function() {
      let dropdownlink = TestUtils.renderIntoDocument(<DropdownLink {...INPUT_1}/>);

      let handlers = jQuery._data(dropdownlink.refs.dropdownToggle.parentNode, 'events');
      expect(handlers).to.be.an('object');

      dropdownlink.componentWillUnmount(dropdownlink);

      handlers = jQuery._data(dropdownlink.refs.dropdownToggle.parentNode, 'events');
      expect(handlers).to.be.an('undefined');
    });
  });

});
