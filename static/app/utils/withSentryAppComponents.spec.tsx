import {act, render} from 'sentry-test/reactTestingLibrary';

import SentryAppComponentsStore from 'sentry/stores/sentryAppComponentsStore';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';

describe('withSentryAppComponents HoC', () => {
  beforeEach(() => {
    SentryAppComponentsStore.init();
  });

  it('handles components without a type', () => {
    const MyComponent = jest.fn(() => null);
    const Container = withSentryAppComponents(MyComponent);
    render(<Container />);

    expect((MyComponent.mock.calls[0] as any)[0]).toEqual({components: []});

    MyComponent.mockClear();

    act(() =>
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
      ])
    );

    expect((MyComponent.mock.calls[0] as any)[0]).toEqual({
      components: [
        expect.objectContaining({type: 'issue-link'}),
        expect.objectContaining({type: 'stacktrace-link'}),
      ],
    });
  });

  it('handles components of a certain type', () => {
    const MyComponent = jest.fn(() => null);
    const Container = withSentryAppComponents(MyComponent, {
      componentType: 'issue-link',
    });
    render(<Container />);

    expect((MyComponent.mock.calls[0] as any)[0]).toEqual({components: []});

    act(() =>
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
      ])
    );

    expect((MyComponent.mock.calls[1] as any)[0]).toEqual({
      components: [
        {
          type: 'issue-link',
          sentryApp: {uuid: 'uuid', name: '', slug: '', avatars: []},
          uuid: '',
          schema: {uri: '', url: '', type: 'stacktrace-link'},
        },
      ],
    });
  });
});
