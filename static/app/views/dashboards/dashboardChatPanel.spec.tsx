import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Block} from 'sentry/views/seerExplorer/types';

import {DashboardChatPanel} from './dashboardChatPanel';

describe('DashboardChatPanel', () => {
  it('renders textarea input', () => {
    render(<DashboardChatPanel blocks={[]} onSend={jest.fn()} isUpdating={false} />, {
      organization: OrganizationFixture(),
    });

    expect(
      screen.getByPlaceholderText('Ask Seer to modify this dashboard...')
    ).toBeInTheDocument();
  });

  it('shows conversation toggle and history', async () => {
    const timestamp = new Date().toISOString();
    const blocks: Block[] = [
      {
        id: '1',
        message: {content: 'Hello', role: 'user'},
        timestamp,
      },
      {
        id: '2',
        message: {content: 'Hi there', role: 'assistant'},
        timestamp,
      },
    ];

    render(<DashboardChatPanel blocks={blocks} onSend={jest.fn()} isUpdating={false} />, {
      organization: OrganizationFixture(),
    });

    expect(screen.getByText(/Conversation.*\(2\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByText(/Conversation.*\(2\)/));

    expect(screen.getByText(/Hello/)).toBeInTheDocument();
    expect(screen.getByText(/Hi there/)).toBeInTheDocument();
  });

  it('calls onSend when submitting a message via Enter', async () => {
    const onSend = jest.fn();
    render(<DashboardChatPanel blocks={[]} onSend={onSend} isUpdating={false} />, {
      organization: OrganizationFixture(),
    });

    const textarea = screen.getByPlaceholderText('Ask Seer to modify this dashboard...');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'Add a chart for errors{Enter}');

    expect(onSend).toHaveBeenCalledWith('Add a chart for errors');
  });
});
