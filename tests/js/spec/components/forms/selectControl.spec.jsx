import React from 'react';
import {shallow} from 'enzyme';

import SelectControl from 'app/components/forms/selectControl';

describe('SelectControl', function() {
  it('renders with react-select "options"', function() {
    let wrapper = shallow(<SelectControl options={[{value: 'foo', label: 'Foo'}]} />);

    expect(wrapper.find('StyledSelect').prop('options')).toEqual([
      {value: 'foo', label: 'Foo'},
    ]);
  });

  it('renders with select2 flat "choices"', function() {
    let wrapper = shallow(<SelectControl choices={['a', 'b', 'c']} name="fieldName" />);
    expect(wrapper.find('StyledSelect').prop('options')).toEqual([
      {value: 'a', label: 'a'},
      {value: 'b', label: 'b'},
      {value: 'c', label: 'c'},
    ]);
  });

  it('renders with select2 paired "choices"', function() {
    let wrapper = shallow(
      <SelectControl
        choices={[['a', 'abc'], ['b', 'bcd'], ['c', 'cde']]}
        name="fieldName"
      />
    );
    expect(wrapper.find('StyledSelect').prop('options')).toEqual([
      {value: 'a', label: 'abc'},
      {value: 'b', label: 'bcd'},
      {value: 'c', label: 'cde'},
    ]);
  });
});
