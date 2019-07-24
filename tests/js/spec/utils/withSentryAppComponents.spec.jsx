import React from 'react';
import {mount} from 'enzyme';

import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';
import withSentryAppComponents from 'app/utils/withSentryAppComponents';

describe('withSentryAppComponents HoC', function() {
  beforeEach(() => {
    SentryAppComponentsStore.init();
  });

  it('handles components of a certain type', function() {
    const MyComponent = () => null;
    const Container = withSentryAppComponents('some-type')(MyComponent);
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('components')).toEqual([]);

    SentryAppComponentsStore.onLoadComponents([
      {type: 'some-type'},
      {type: 'another-type'},
    ]);
    wrapper.update();

    expect(wrapper.find('MyComponent').prop('components')).toEqual([{type: 'some-type'}]);
  });
});
