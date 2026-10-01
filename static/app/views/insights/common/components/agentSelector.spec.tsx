import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AgentSelector} from 'sentry/views/insights/common/components/agentSelector';

const organization = OrganizationFixture();

describe('AgentSelector', () => {
  it('explains why the selector is disabled when no agents are found', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });

    render(<AgentSelector referrer="test" />, {organization});

    const trigger = await screen.findByRole('button', {name: 'All Agents'});
    expect(trigger).toHaveAttribute('aria-disabled', 'true');

    await userEvent.hover(trigger);
    expect(
      await screen.findByText(
        'No agents found for the selected projects, environments, and date range.'
      )
    ).toBeInTheDocument();
  });

  it('is enabled without a tooltip when agents are found', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [{'gen_ai.agent.name': 'Weather Agent', 'count()': 5}]},
    });

    render(<AgentSelector referrer="test" />, {organization});

    const trigger = await screen.findByRole('button', {name: 'All Agents'});
    await waitFor(() => expect(trigger).toBeEnabled());

    await userEvent.click(trigger);
    expect(
      await screen.findByRole('option', {name: 'Weather Agent'})
    ).toBeInTheDocument();
  });
});
