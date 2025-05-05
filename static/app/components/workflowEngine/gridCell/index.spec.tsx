import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {TooltipContext} from 'sentry/components/core/tooltip';

import {ActionCell} from './actionCell';
import {ConnectionCell} from './connectionCell';
import {NumberCell} from './numberCell';
import {TimeAgoCell} from './timeAgoCell';
import {TypeCell} from './typeCell';

describe('Action Cell Component', function () {
  it('renders', function () {
    render(<ActionCell actions={['slack', 'discord', 'email']} />);

    const text = screen.getByText('Slack, Discord, Email');
    expect(text).toBeInTheDocument();
  });

  it('renders tooltip', async function () {
    const container = document.createElement('div');
    render(
      <TooltipContext value={{container}}>
        <ActionCell actions={['slack', 'discord', 'email']} />
      </TooltipContext>
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

describe('Connection Cell Component', function () {
  it('renders monitors', function () {
    render(<ConnectionCell ids={['12345']} type="detector" />);

    const text = screen.getByText('1 monitor');
    expect(text).toBeInTheDocument();
  });

  it('renders automations', function () {
    render(<ConnectionCell ids={['12345']} type="workflow" />);
    const text = screen.getByText('1 automation');
    expect(text).toBeInTheDocument();
  });

  it('renders detector hovercard', async function () {
    render(<ConnectionCell ids={['12345']} type="detector" />);

    const span = screen.getByText('1 monitor');
    expect(span).toBeInTheDocument();
    await userEvent.hover(span, {delay: 100});
    const overlay = await screen.findByRole('link');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('href');
    expect(overlay).toHaveAttribute('href', '/issues/monitors/12345/');
  });

  it('renders workflow hovercard', async function () {
    render(<ConnectionCell ids={['12345']} type="workflow" />);

    const span = screen.getByText('1 automation');
    expect(span).toBeInTheDocument();
    await userEvent.hover(span, {delay: 100});
    const overlay = await screen.findByRole('link');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('href');
    expect(overlay).toHaveAttribute('href', '/issues/automations/12345/');
  });
});

describe('Number Cell Component', function () {
  it('renders', () => {
    render(<NumberCell number={3} />);

    const text = screen.getByText('3');
    expect(text).toBeInTheDocument();
  });
});

describe('Type Cell Component', function () {
  it('renders', () => {
    render(<TypeCell type="metric" />);

    const text = screen.getByText('Metric');
    expect(text).toBeInTheDocument();
  });

  it('renders disabled', () => {
    render(<TypeCell type="metric" disabled />);

    const text = screen.getByText('Metric');
    expect(text).toBeInTheDocument();
  });
});
