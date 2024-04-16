import startCase from 'lodash/startCase';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';

describe('ContextCard', function () {
  it('renders the card with formatted context data', function () {
    const event = EventFixture();
    const group = GroupFixture();
    const {project} = initializeOrg();
    const alias = 'Things in my Vicinity';
    const simpleContext = {
      snack: 'peanut',
      dinner: 'rice',
      friend: 'noelle',
    };
    const structuredContext = {
      'my dogs': ['cocoa', 'butter'],
      book: {
        title: 'This Is How You Lose the Time War',
        pages: 208,
        published: '2018-07-21T00:00:00.000Z',
      },
    };
    const customContext = {
      ...simpleContext,
      ...structuredContext,
      type: 'default',
    };
    render(
      <ContextCard
        type="default"
        alias={alias}
        value={customContext}
        event={event}
        group={group}
        project={project}
      />
    );

    expect(screen.getByText(startCase(alias))).toBeInTheDocument();
    Object.entries(simpleContext).forEach(([key, value]) => {
      expect(screen.getByText(key)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    });
    Object.entries(structuredContext).forEach(([key, value]) => {
      expect(screen.getByText(key)).toBeInTheDocument();
      expect(
        screen.getByText(`${Object.values(value).length} items`)
      ).toBeInTheDocument();
    });
  });

  it('renders the annotated text and errors', function () {
    const alias = 'broken';
    const event = EventFixture({
      _meta: {
        contexts: {
          default: {
            error: {
              '': {
                err: [
                  [
                    'invalid_data',
                    {
                      reason: 'expected something better',
                    },
                  ],
                ],
                val: 'worse',
              },
            },
            redacted: {
              '': {
                chunks: [
                  {
                    remark: 'x',
                    rule_id: 'project:0',
                    text: '',
                    type: 'redaction',
                  },
                ],
                len: 9,
                rem: [['project:0', 'x', 0, 0]],
              },
            },
          },
        },
      },
    });
    const group = GroupFixture();
    const {project} = initializeOrg();
    const errorContext = {
      error: '',
      redacted: '',
      type: 'default',
    };

    render(
      <ContextCard
        type="default"
        alias={alias}
        value={errorContext}
        event={event}
        group={group}
        project={project}
      />
    );

    expect(screen.getByText('<invalid>')).toBeInTheDocument();
    expect(screen.getByTestId('annotated-text-error-icon')).toBeInTheDocument();
    expect(screen.getByText('<redacted>')).toBeInTheDocument();
  });
});
