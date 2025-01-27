import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {TooltipContext} from 'sentry/components/tooltip';

import {ActionCell} from './actionCell';
import {MonitorsCell} from './monitorsCell';
import {TimeAgoCell} from './timeAgoCell';

describe('Action Cell Component', function () {
  it('renders', function () {
    render(<ActionCell actions={['slack', 'discord', 'email']} />);

    const text = screen.getByText('Slack, Discord, Email');
    expect(text).toBeInTheDocument();
  });

  it('renders tooltip', async function () {
    const container = document.createElement('div');
    render(
      <TooltipContext.Provider value={{container}}>
        <ActionCell actions={['slack', 'discord', 'email']} />
      </TooltipContext.Provider>
    );

    const span = screen.getByText('Slack, Discord, Email');
    expect(span).toBeInTheDocument();
    await userEvent.hover(span, {delay: 100});
    expect(container).toHaveTextContent('Slack, Discord, Email');
  });
});

describe('Time Ago Cell Component', function () {
  it('renders', () => {
    render(<TimeAgoCell date={new Date()} />);

    const text = screen.getByText('a few seconds ago');
    expect(text).toBeInTheDocument();
  });
});

const renderMonitorCell = () => {
  render(
    <MonitorsCell
      monitors={[
        {
          name: '/endpoint',
          id: 'def456',
          project: {slug: 'javascript', platform: 'javascript'},
          description: 'transaction.duration',
        },
      ]}
    />
  );
};

describe('Monitors Cell Component', function () {
  it('renders children and context values', function () {
    renderMonitorCell();

    const text = screen.getByText('1 monitor');
    expect(text).toBeInTheDocument();
  });

  it('renders hovercard', async function () {
    renderMonitorCell();

    const span = screen.getByText('1 monitor');
    expect(span).toBeInTheDocument();
    await userEvent.hover(span, {delay: 100});
    expect(await screen.findByText('/endpoint')).toBeInTheDocument();
    expect(await screen.findByText('javascript')).toBeInTheDocument();
    expect(await screen.findByText('transaction.duration')).toBeInTheDocument();
  });
});
