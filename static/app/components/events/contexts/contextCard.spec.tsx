import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import * as iconTools from 'sentry/components/events/contexts/contextIcon';

describe('ContextCard', function () {
  const group = GroupFixture();
  const project = ProjectFixture();
  it('renders the card with formatted context data', function () {
    const event = EventFixture();
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

    expect(screen.getByText(alias)).toBeInTheDocument();
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

  it('renders with icons if able', function () {
    const event = EventFixture();
    const iconSpy = jest
      .spyOn(iconTools, 'getLogoImage')
      .mockReturnValue('data:image/firefox');

    const browserContext = {
      type: 'browser',
      name: 'firefox',
      version: 'Infinity',
    };
    const browserCard = render(
      <ContextCard
        type="browser"
        alias="browser"
        value={browserContext}
        event={event}
        group={group}
        project={project}
      />
    );
    expect(iconSpy.mock.calls[0]![0]).toBe(browserContext.name);
    expect(screen.getByRole('img')).toBeInTheDocument();

    iconSpy.mockReset();
    browserCard.unmount();

    const unknownContext = {
      type: 'default',
      organization: 'acme',
      tier: 'gold',
    };
    render(
      <ContextCard
        type="default"
        alias="organization"
        value={unknownContext}
        event={event}
        group={group}
        project={project}
      />
    );
    expect(iconSpy.mock.results).toHaveLength(0);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the annotated text and errors', function () {
    const alias = 'broken';
    const event = EventFixture({
      _meta: {
        contexts: {
          [alias]: {
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
