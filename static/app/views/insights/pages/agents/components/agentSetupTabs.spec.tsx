import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {getAgentSetupPrompt} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';

import {AgentSetupTabs} from './agentSetupTabs';

describe('AgentSetupTabs', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({platform: 'node'});
  const dsn = 'https://public@sentry.example.com/1';

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue(undefined)},
    });
  });

  it('defaults to the prompt tab and copies the prompt', async () => {
    const onInteraction = jest.fn();
    const prompt = getAgentSetupPrompt({
      organizationSlug: organization.slug,
      project,
      dsn,
    });

    render(
      <AgentSetupTabs
        project={project}
        dsn={dsn}
        waitingIndicator={null}
        onInteraction={onInteraction}
      >
        Step-by-step instructions
      </AgentSetupTabs>,
      {organization}
    );

    expect(
      screen.getByRole('tab', {name: 'For your agent', selected: true})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Copy prompt'}));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(prompt);
    expect(onInteraction).toHaveBeenCalledWith({action: 'copy_agent_prompt'});
  });

  it('shows the instructions when switching tabs', async () => {
    const onInteraction = jest.fn();

    render(
      <AgentSetupTabs
        project={project}
        dsn={dsn}
        waitingIndicator={null}
        onInteraction={onInteraction}
      >
        Step-by-step instructions
      </AgentSetupTabs>,
      {organization}
    );

    await userEvent.click(screen.getByRole('tab', {name: 'For you'}));

    expect(screen.getByText('Step-by-step instructions')).toBeInTheDocument();
    expect(onInteraction).toHaveBeenCalledWith({action: 'switch_tab', tab: 'human'});
  });

  it('disables the prompt tab without a DSN', () => {
    render(
      <AgentSetupTabs project={project} waitingIndicator={null}>
        Step-by-step instructions
      </AgentSetupTabs>,
      {organization}
    );

    expect(screen.getByRole('tab', {name: 'For your agent'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(
      screen.getByRole('tab', {name: 'For you', selected: true})
    ).toBeInTheDocument();
    expect(screen.getByText('Step-by-step instructions')).toBeInTheDocument();
  });

  it('disables the instructions tab when the platform has none', () => {
    render(
      <AgentSetupTabs
        project={project}
        dsn={dsn}
        waitingIndicator={null}
        hasPlatformInstructions={false}
      >
        Not supported
      </AgentSetupTabs>,
      {organization}
    );

    expect(screen.getByRole('tab', {name: 'For you'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(
      screen.getByRole('tab', {name: 'For your agent', selected: true})
    ).toBeInTheDocument();
  });
});
