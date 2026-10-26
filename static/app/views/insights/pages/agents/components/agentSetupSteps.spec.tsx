import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  AgentIntegration,
  DeploymentTarget,
} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';
import type {ReadyAgentOnboardingSetup} from 'sentry/views/insights/pages/agents/utils/useAgentOnboardingSetup';

import {AgentSetupSteps} from './agentSetupSteps';

const steps: OnboardingStep[] = [
  {type: StepType.INSTALL, content: [{type: 'text', text: 'Install the SDK.'}]},
  {type: StepType.CONFIGURE, content: [{type: 'text', text: 'Configure the SDK.'}]},
  {type: StepType.VERIFY, content: [{type: 'text', text: 'Verify the setup.'}]},
];

function makeSetup(deploymentTarget: DeploymentTarget): ReadyAgentOnboardingSetup {
  return {
    status: 'ready',
    project: ProjectFixture({platform: 'node-pi-durable'}),
    dsn: ProjectKeysFixture()[0]!.dsn,
    introduction: null,
    installSteps: [],
    configureSteps: [],
    verifySteps: [],
    deploymentTarget,
    integrationDeploymentTarget: undefined,
    isPhpPlatform: false,
    isPythonPlatform: false,
    platformOptions: {},
    projectAgentIntegration: AgentIntegration.PI,
    selectedPlatformOptions: {integration: AgentIntegration.PI},
    showPlatformOptions: true,
  };
}

describe('AgentSetupSteps', () => {
  it('resumes at the step stored in the URL', () => {
    render(
      <AgentSetupSteps
        setup={makeSetup(DeploymentTarget.NODE)}
        steps={steps}
        lastStepItems={null}
      />,
      {initialRouterConfig: {location: {pathname: '/', query: {guidedStep: '2'}}}}
    );

    expect(screen.getByText('Configure the SDK.')).toBeInTheDocument();
    expect(screen.queryByText('Install the SDK.')).not.toBeInTheDocument();
  });

  it('stores the current step in the URL', async () => {
    const {router} = render(
      <AgentSetupSteps
        setup={makeSetup(DeploymentTarget.NODE)}
        steps={steps}
        lastStepItems={null}
      />,
      {initialRouterConfig: {location: {pathname: '/'}}}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(screen.getByText('Configure the SDK.')).toBeInTheDocument();
    expect(router.location.query.guidedStep).toBe('2');
  });

  it('starts at the first step when the runtime changes', () => {
    const {rerender} = render(
      <AgentSetupSteps
        setup={makeSetup(DeploymentTarget.NODE)}
        steps={steps}
        lastStepItems={null}
      />,
      {initialRouterConfig: {location: {pathname: '/', query: {guidedStep: '2'}}}}
    );

    expect(screen.getByText('Configure the SDK.')).toBeInTheDocument();

    // The stored step belongs to the Node steps, not the Deno ones.
    rerender(
      <AgentSetupSteps
        setup={makeSetup(DeploymentTarget.DENO)}
        steps={steps}
        lastStepItems={null}
      />
    );

    expect(screen.getByText('Install the SDK.')).toBeInTheDocument();
    expect(screen.queryByText('Configure the SDK.')).not.toBeInTheDocument();
  });
});
