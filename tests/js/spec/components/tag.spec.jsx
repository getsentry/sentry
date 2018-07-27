import React from 'react';
import {shallow} from 'enzyme';
import Tag from 'app/views/settings/components/tag';

describe('Tag', function() {
  it('renders', function() {
    let wrapper = shallow(
      <Tag priority="info" border={true} size="small">
        Text to Copy
      </Tag>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
