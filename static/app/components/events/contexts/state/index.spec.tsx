import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {StateEventContext} from 'sentry/components/events/contexts/state';

describe('StateContext', function () {
  it('renders', function () {
    render(
      <StateEventContext
        data={{
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
        }}
        event={EventFixture()}
      />
    );

    expect(screen.getByText('State (Redux)')).toBeInTheDocument();
    expect(screen.getByText('otherState')).toBeInTheDocument();

    expect(screen.getByText(textWithMarkupMatcher('{a: abc}'))).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher('{b: bcd}'))).toBeInTheDocument();
  });

  it('display redacted data', async function () {
    const event = EventFixture({
      _meta: {
        contexts: {
          state: {
            state: {
              value: {
                '': {
                  rem: [['project:1', 's', 0, 0]],
                  len: 25,
                },
              },
            },
          },
        },
      },
    });

    render(
      <StateEventContext
        data={{
          state: {
            type: 'redux',
            value: null,
          },
          otherState: {
            value: {
              b: 'bcd',
            },
          },
        }}
        event={event}
      />
    );

    expect(screen.getByText('State (Redux)')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('None'));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
