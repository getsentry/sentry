import React from 'react';

import {mount} from 'sentry-test/enzyme';

import StateContextType from 'app/components/events/contexts/state';

const STATE_CONTEXT = {
  type: 'state',
  state: {
    type: 'redux',
    value: {
      a: 'abc',
    },
  },
  otherState: {
    value: {
      b: 'bcd',
    },
  },
};

describe('StateContext', function() {
  it('renders', () => {
    const wrapper = mount(<StateContextType alias="state" data={STATE_CONTEXT} />);

    expect(wrapper.find('TableSubject.key').text()).toEqual('State (Redux)');
    expect(wrapper.find('.val').text()).toEqual('{a: abc}');
  });
});
