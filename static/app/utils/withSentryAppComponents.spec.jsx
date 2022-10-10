import {render} from 'sentry-test/reactTestingLibrary';

import SentryAppComponentsStore from 'sentry/stores/sentryAppComponentsStore';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';

describe('withSentryAppComponents HoC', function () {
  beforeEach(() => {
    SentryAppComponentsStore.init();
  });

  it('handles components without a type', function () {
    const MyComponent = jest.fn(() => null);
    const Container = withSentryAppComponents(MyComponent);
    render(<Container />);

    expect(MyComponent).toHaveBeenCalledWith({components: []}, {});

    MyComponent.mockClear();

    SentryAppComponentsStore.loadComponents([
      {type: 'some-type'},
      {type: 'another-type'},
    ]);

    expect(MyComponent).toHaveBeenCalledWith(
      {components: [{type: 'some-type'}, {type: 'another-type'}]},
      {}
    );
  });

  it('handles components of a certain type', function () {
    const MyComponent = jest.fn(() => null);
    const Container = withSentryAppComponents(MyComponent, {componentType: 'some-type'});
    render(<Container />);

    expect(MyComponent).toHaveBeenCalledWith({components: []}, {});

    SentryAppComponentsStore.loadComponents([
      {type: 'some-type'},
      {type: 'another-type'},
    ]);

    expect(MyComponent).toHaveBeenCalledWith({components: [{type: 'some-type'}]}, {});
  });
});
