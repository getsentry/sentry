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

    const keys = wrapper.find('TableSubject.key');
    const values = wrapper.find('.val');

    expect(keys.at(0).text()).toEqual('State (Redux)');
    expect(keys.at(1).text()).toEqual('otherState');

    expect(values.at(0).text()).toEqual('{a: abc}');
    expect(values.at(1).text()).toEqual('{b: bcd}');
  });
});
