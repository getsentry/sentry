import {useState} from 'react';
import {useTheme} from '@emotion/react';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {StepIndexProvider} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {StepTitles} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {PlatformOptionDropdown} from 'sentry/components/onboarding/platformOptionDropdown';
import {t} from 'sentry/locale';
import {agentMonitoringEventMap} from 'sentry/utils/analytics/agentMonitoringAnalyticsEvents';
import {conversationsEventMap} from 'sentry/utils/analytics/conversationsAnalyticsEvents';
import {decodeInteger} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {ReadyAgentOnboardingSetup} from 'sentry/views/insights/pages/agents/utils/useAgentOnboardingSetup';
import {PulseSpacer} from 'sentry/views/insights/pages/onboardingUtils';

/**
 * Analytics events the step navigation buttons can send, with the action and
 * the 1-based step number as params.
 */
const STEP_ANALYTICS_EVENT_NAMES = {
  'agent-monitoring.onboarding.interaction':
    agentMonitoringEventMap['agent-monitoring.onboarding.interaction'],
  'conversations.onboarding.interaction':
    conversationsEventMap['conversations.onboarding.interaction'],
};

type StepAnalyticsEventKey = keyof typeof STEP_ANALYTICS_EVENT_NAMES;

/**
 * The integration and runtime selectors for the agent onboarding. Render it
 * only when `setup.showPlatformOptions` is set.
 */
export function AgentSetupOptions({
  setup,
  onChange,
}: {
  setup: ReadyAgentOnboardingSetup;
  onChange?: (key: string, value: string) => void;
}) {
  return (
    <PlatformOptionDropdown
      platformOptions={setup.platformOptions}
      // Framework projects only render the runtime selector, which then
      // directly follows "with".
      connectors={setup.projectAgentIntegration ? undefined : {deploymentTarget: t('on')}}
      onChange={onChange}
      lockedValues={
        setup.integrationDeploymentTarget
          ? {deploymentTarget: setup.integrationDeploymentTarget}
          : undefined
      }
    />
  );
}

function StepRenderer({
  step,
  stepIndex,
  isLastStep,
  lastStepItems,
  analyticsEventKey,
  trailingItems,
}: {
  isLastStep: boolean;
  lastStepItems: React.ReactNode;
  step: OnboardingStep;
  stepIndex: number;
  analyticsEventKey?: StepAnalyticsEventKey;
  trailingItems?: React.ReactNode;
}) {
  const theme = useTheme();
  const getAnalyticsProps = (action: 'previous_step' | 'next_step') =>
    analyticsEventKey
      ? {
          analyticsEventKey,
          analyticsEventName: STEP_ANALYTICS_EVENT_NAMES[analyticsEventKey],
          analyticsParams: {action, step: stepIndex + 1},
        }
      : {};

  return (
    <GuidedSteps.Step
      stepKey={step.type || step.title}
      title={step.title || (step.type && StepTitles[step.type])}
      trailingItems={trailingItems}
    >
      <StepIndexProvider index={stepIndex}>
        <ContentBlocksRenderer spacing={theme.space.md} contentBlocks={step.content} />
      </StepIndexProvider>
      <GuidedSteps.ButtonWrapper>
        <GuidedSteps.BackButton size="md" {...getAnalyticsProps('previous_step')} />
        <GuidedSteps.NextButton size="md" {...getAnalyticsProps('next_step')} />
        {isLastStep && lastStepItems}
      </GuidedSteps.ButtonWrapper>
      {/* This spacer ensures the whole pulse effect is visible, as the parent has overflow: hidden */}
      {isLastStep && <PulseSpacer />}
    </GuidedSteps.Step>
  );
}

/**
 * The guided setup steps of the agent onboarding. The current step is kept in
 * the `guidedStep` query param.
 */
export function AgentSetupSteps({
  setup,
  steps,
  lastStepItems,
  firstStepTrailingItems,
  analyticsEventKey,
}: {
  /**
   * Rendered next to the navigation buttons of the last step, usually an
   * indicator that waits for the first events.
   */
  lastStepItems: React.ReactNode;
  setup: ReadyAgentOnboardingSetup;
  steps: OnboardingStep[];
  analyticsEventKey?: StepAnalyticsEventKey;
  firstStepTrailingItems?: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const selectionKey = `${setup.selectedPlatformOptions.integration}-${setup.deploymentTarget}`;
  // The selection the `guidedStep` query param was recorded for. Other
  // selections have different steps, so they start from the first one.
  const [guidedStepSelectionKey, setGuidedStepSelectionKey] = useState(selectionKey);

  return (
    <GuidedSteps
      // Remount when the integration or runtime changes so the stepper doesn't
      // carry over stale per-step state from the previous selection.
      key={selectionKey}
      initialStep={
        selectionKey === guidedStepSelectionKey
          ? decodeInteger(location.query.guidedStep)
          : undefined
      }
      onStepChange={step => {
        setGuidedStepSelectionKey(selectionKey);
        navigate({
          pathname: location.pathname,
          query: {
            ...location.query,
            guidedStep: step,
          },
        });
      }}
    >
      {steps.map((step, index) => (
        <StepRenderer
          key={step.title || step.type}
          step={step}
          stepIndex={index}
          isLastStep={index === steps.length - 1}
          lastStepItems={lastStepItems}
          analyticsEventKey={analyticsEventKey}
          trailingItems={index === 0 ? firstStepTrailingItems : undefined}
        />
      ))}
    </GuidedSteps>
  );
}
