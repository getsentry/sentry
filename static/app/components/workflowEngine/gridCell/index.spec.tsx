import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {TooltipContext} from 'sentry/components/core/tooltip';
import {ActionType} from 'sentry/types/workflowEngine/actions';

import {ActionCell} from './actionCell';
import {TimeAgoCell} from './timeAgoCell';

describe('Action Cell Component', function () {
  it('renders', function () {
    render(
      <ActionCell actions={[ActionType.SLACK, ActionType.DISCORD, ActionType.EMAIL]} />
    );

    const text = screen.getByText('Slack, Discord, Email');
    expect(text).toBeInTheDocument();
  });

  it('renders tooltip', async function () {
    const container = document.createElement('div');
    render(
      <TooltipContext value={{container}}>
        <ActionCell actions={[ActionType.SLACK, ActionType.DISCORD, ActionType.EMAIL]} />
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
