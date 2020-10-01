import React from 'react';

import {mount} from 'sentry-test/enzyme';

import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';
import withSentryAppComponents from 'app/utils/withSentryAppComponents';

describe('withSentryAppComponents HoC', function () {
  beforeEach(() => {
    SentryAppComponentsStore.init();
  });

  it('handles components without a type', function () {
    const MyComponent = () => null;
    const Container = withSentryAppComponents(MyComponent);
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('components')).toEqual([]);

    SentryAppComponentsStore.onLoadComponents([
      {type: 'some-type'},
      {type: 'another-type'},
    ]);
    wrapper.update();

    expect(wrapper.find('MyComponent').prop('components')).toEqual([
      {type: 'some-type'},
      {type: 'another-type'},
    ]);
  });

  it('handles components of a certain type', function () {
    const MyComponent = () => null;
    const Container = withSentryAppComponents(MyComponent, {componentType: 'some-type'});
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
