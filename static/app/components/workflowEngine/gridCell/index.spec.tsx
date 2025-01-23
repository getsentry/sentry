import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MonitorsCell} from './monitorsCell';
import {TimeAgoCell} from './timeAgoCell';
import {Action, ActionCell} from './actionCell';

describe('Action Cell Component', function () {
  it('renders', function () {
    render(<ActionCell actions={[Action.SLACK, Action.DISCORD, Action.EMAIL]} />);

    const text = screen.getByText('Slack, Discord, Email');
    expect(text).toBeInTheDocument();
    userEvent.hover(text);
  });
});

describe('Time Ago Cell Component', function () {
  it('renders', function () {
    render(<TimeAgoCell date={new Date()} />);

    const text = screen.getByText('a few seconds ago');
    expect(text).toBeInTheDocument();
    userEvent.hover(text);
  });
});

describe('Monitors Cell Component', function () {
  it('renders children and context values', function () {
    render(
      <MonitorsCell
        monitors={[
          {
            name: '/endpoint',
            id: 'def456',
            project: {slug: 'javascript', platform: 'javascript'},
            description: 'transaction.duration',
          },
          {
            name: '/checkout',
            id: 'ghi789',
            project: {slug: 'javascript', platform: 'javascript'},
            description: 'transaction.duration',
          },
        ]}
      />
    );

    const text = screen.getByText('2 monitors');
    expect(text).toBeInTheDocument();
    userEvent.hover(text);
  });
});
