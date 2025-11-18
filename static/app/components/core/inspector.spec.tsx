import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as constants from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';

import {SentryComponentInspector} from './inspector';

jest.mock('sentry/constants');

// We need to mock this as require.context is not available
jest.mock('sentry/stories/view/useStoriesLoader', () => {
  return {
    useStoryBookFiles: jest.fn(() => []),
  };
});

describe('SentryComponentInspector', () => {
  it.each([
    ['development', true],
    ['production', false],
    ['test', false],
  ])('adds event listener for ENV=%s', (env, expectCalled) => {
    jest.mocked(constants).NODE_ENV = env;

    const mockUser = UserFixture();
    ConfigStore.set('user', mockUser);

    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    render(
      <div>
        <SentryComponentInspector />
        <div
          data-sentry-source-path="/static/app/components/test/component.tsx"
          data-sentry-component="TestComponent"
        >
          Test Component Content
        </div>
      </div>
    );

    if (expectCalled) {
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'devtools.toggle_component_inspector',
        expect.any(Function)
      );
    } else {
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'devtools.toggle_component_inspector',
        expect.any(Function)
      );
    }
  });

  it('renders a preview trace of the component', async () => {
    jest.mocked(constants).NODE_ENV = 'development';

    const mockUser = UserFixture({isSuperuser: true});
    ConfigStore.set('user', mockUser);

    render(
      <div>
        <SentryComponentInspector />
        <div
          data-sentry-source-path="/static/app/components/test/parent.tsx"
          data-sentry-component="ParentComponent"
        >
          Parent Component Content
          {/* intermediary div that should be skipped */}
          <div>
            <div
              data-sentry-source-path="/static/app/components/test/component.tsx"
              data-sentry-component="TestComponent"
            >
              Test Component Content
            </div>
          </div>
        </div>
      </div>
    );

    await waitFor(() => {
      window.dispatchEvent(new Event('devtools.toggle_component_inspector'));
    });
    await userEvent.hover(screen.getByText('Test Component Content'));
    expect(await screen.findByText('Hovered Components')).toBeInTheDocument();

    expect(await screen.findByText('TestComponent')).toBeInTheDocument();
    expect(
      await screen.findByText('.../app/components/test/component.tsx')
    ).toBeInTheDocument();

    expect(await screen.findByText('ParentComponent')).toBeInTheDocument();
    expect(
      await screen.findByText('.../app/components/test/parent.tsx')
    ).toBeInTheDocument();
  });
});
