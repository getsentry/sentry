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
      {
        type: 'issue-link',
        sentryApp: {uuid: 'uuid', name: '', slug: '', avatars: []},
        uuid: '',
        schema: {uri: '', url: '', type: 'stacktrace-link'},
      },
      {
        type: 'stacktrace-link',
        sentryApp: {uuid: 'uuid', name: '', slug: '', avatars: []},
        uuid: '',
        schema: {uri: '', url: '', type: 'stacktrace-link'},
      },
    ]);

    expect(MyComponent).toHaveBeenCalledWith(
      {
        components: [
          expect.objectContaining({type: 'issue-link'}),
          expect.objectContaining({type: 'stacktrace-link'}),
        ],
      },
      {}
    );
  });

  it('handles components of a certain type', function () {
    const MyComponent = jest.fn(() => null);
    const Container = withSentryAppComponents(MyComponent, {
      componentType: 'issue-link',
    });
    render(<Container />);

    expect(MyComponent).toHaveBeenCalledWith({components: []}, {});

    SentryAppComponentsStore.loadComponents([
      {
        type: 'issue-link',
        sentryApp: {uuid: 'uuid', name: '', slug: '', avatars: []},
        uuid: '',
        schema: {uri: '', url: '', type: 'stacktrace-link'},
      },
      {
        type: 'stacktrace-link',
        sentryApp: {uuid: 'uuid', name: '', slug: '', avatars: []},
        uuid: '',
        schema: {uri: '', url: '', type: 'stacktrace-link'},
      },
    ]);

    expect(MyComponent).toHaveBeenCalledWith(
      {
        components: [
          {
            type: 'issue-link',
            sentryApp: {uuid: 'uuid', name: '', slug: '', avatars: []},
            uuid: '',
            schema: {uri: '', url: '', type: 'stacktrace-link'},
          },
        ],
      },
      {}
    );
  });
});
