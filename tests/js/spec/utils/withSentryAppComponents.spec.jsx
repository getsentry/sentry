import {mountWithTheme} from 'sentry-test/enzyme';

import SentryAppComponentsStore from 'sentry/stores/sentryAppComponentsStore';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';

describe('withSentryAppComponents HoC', function () {
  beforeEach(() => {
    SentryAppComponentsStore.init();
  });

  afterEach(() => {
    SentryAppComponentsStore.teardown();
  });

  it('handles components without a type', function () {
    const MyComponent = () => null;
    const Container = withSentryAppComponents(MyComponent);
    const wrapper = mountWithTheme(<Container />);

    expect(wrapper.find('MyComponent').prop('components')).toEqual([]);

    SentryAppComponentsStore.loadComponents([
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
    const wrapper = mountWithTheme(<Container />);

    expect(wrapper.find('MyComponent').prop('components')).toEqual([]);

    SentryAppComponentsStore.loadComponents([
      {type: 'some-type'},
      {type: 'another-type'},
    ]);
    wrapper.update();

    expect(wrapper.find('MyComponent').prop('components')).toEqual([{type: 'some-type'}]);
  });
});
