import React from 'react';
import {shallow} from 'enzyme';
import {HighlightComponent} from 'app/components/highlight';

describe('Highlight', function() {
  it('highlights text', function() {
    // shallow because `mount` and React Fragments don't work when accessing children
    // it will only return first child
    let wrapper = shallow(
      <HighlightComponent text="ILL">billy@sentry.io</HighlightComponent>,
      TestStubs.routerContext()
    );
    expect(
      wrapper
        .children()
        .at(0)
        .text()
    ).toBe('b');
    expect(wrapper.find('span').text()).toBe('ill');
    expect(
      wrapper
        .children()
        .at(2)
        .text()
    ).toBe('y@sentry.io');
  });
});
