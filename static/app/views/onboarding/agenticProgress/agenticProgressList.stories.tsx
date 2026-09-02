import {useState} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconChevron} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import {WelcomeAgentSetup} from 'sentry/views/onboarding/components/welcomeAgentSetup';

import {AgenticProgress} from './agenticProgressList';
import type {AgenticProgressRun} from './types';

type AgenticProgressStageState = AgenticProgressRun['stages'][number];

function makeAgenticProgressRun(
  params: Partial<AgenticProgressRun> = {}
): AgenticProgressRun {
  return {
    channelId: '54c300212517432d91c915960bfc5c09',
    clientRunId: '021902d5-2333-4823-81a9-5596b331e8af',
    continueUpdates: true,
    createdAt: '2026-08-13T14:01:28.298407Z',
    expiresAt: '2026-08-14T14:01:28.298407Z',
    runId: '16ff4fe7966f495ab788069fb35d8e7b',
    runStatus: 'active',
    schemaVersion: 1,
    sequence: 0,
    stages: [],
    updatedAt: '2026-08-13T14:01:28.298407Z',
    ...params,
  };
}

const pendingStages: AgenticProgressStageState[] = [
  {stage: 'connect_mcp', status: 'completed', eventNote: null, extra: null},
  {stage: 'analyze_project', status: null, eventNote: null, extra: null},
  {stage: 'create_project', status: null, eventNote: null, extra: null},
  {stage: 'instrument_app', status: null, eventNote: null, extra: null},
  {stage: 'plan_test_error', status: null, eventNote: null, extra: null},
  {stage: 'send_verification_error', status: null, eventNote: null, extra: null},
  {stage: 'receive_verification_error', status: null, eventNote: null, extra: null},
  {stage: 'prepare_production', status: null, eventNote: null, extra: null},
  {stage: 'check_stack_trace_quality', status: null, eventNote: null, extra: null},
];

const createdProjectSlugs = ['react-frontend', 'python-backend'];
// The issue the story's run reports back. Storybook has no group to resolve it
// against, so the completed run's issue card stays out — driving the run to a
// terminal state with the shape the agent actually sends is the point here.
const verificationIssueIds = ['4815162342'];

export default Storybook.story('Agentic Onboarding Progress', story => {
  story('All states', () => (
    <StoryFrame>
      <AgenticProgress
        run={makeAgenticProgressRun({
          sequence: 9,
          stages: [
            {stage: 'connect_mcp', status: 'completed', eventNote: null, extra: null},
            {
              stage: 'analyze_project',
              status: 'completed',
              eventNote: 'Detected a React application using Vite.',
              extra: null,
            },
            {
              stage: 'create_project',
              status: 'skipped',
              eventNote: 'The project already exists in this organization.',
              extra: null,
            },
            {
              stage: 'instrument_app',
              status: 'bypassed',
              eventNote: 'Instrumentation is managed by another package.',
              extra: null,
            },
            {
              stage: 'plan_test_error',
              status: 'failed',
              eventNote: 'Could not determine a safe path for a test error.',
              extra: null,
            },
            {
              stage: 'send_verification_error',
              status: 'waiting',
              eventNote:
                'Open the application and click “Trigger test error” to continue.',
              extra: null,
            },
            {
              stage: 'receive_verification_error',
              status: null,
              eventNote: null,
              extra: null,
            },
            {
              stage: 'prepare_production',
              status: 'active',
              eventNote: 'Reviewing source maps and release configuration.',
              extra: null,
            },
            {
              stage: 'check_stack_trace_quality',
              status: null,
              eventNote: null,
              extra: null,
            },
          ],
        })}
      />
    </StoryFrame>
  ));

  story('Interactive progress', () => <InteractiveProgressStory />);

  story('Connecting an agent', () => <AgentConnectionStory />);
});

/**
 * The welcome step's own composition, driven by a toggle rather than a real
 * agent. Rendering WelcomeAgentSetup itself (not a copy of its markup) is what
 * makes this useful for the setup card to progress list transition: the card
 * swap, the box resizing between the two heights, and the manual path
 * collapsing are all the components' own, so what happens here is what happens
 * in onboarding.
 */
function AgentConnectionStory() {
  const [isAgentConnected, setIsAgentConnected] = useState(false);

  return (
    <StoryFrame>
      <Stack gap="2xl" align="start">
        <Button onClick={() => setIsAgentConnected(connected => !connected)}>
          {isAgentConnected ? 'Disconnect agent' : 'Connect agent'}
        </Button>
        <Container width="100%" maxWidth="480px">
          <WelcomeAgentSetup
            isAgentConnected={isAgentConnected}
            onboardingCode="Lg1iSt2qeQ"
            onCopyCommand={() => {}}
            onSetupInBrowser={() => {}}
            run={makeAgenticProgressRun({
              sequence: 3,
              stages: pendingStages.map(stage =>
                stage.stage === 'analyze_project'
                  ? {
                      ...stage,
                      status: 'completed',
                      eventNote: 'Detected a React application using Vite.',
                    }
                  : stage.stage === 'create_project'
                    ? {...stage, status: 'active'}
                    : stage
              ),
            })}
          />
        </Container>
      </Stack>
    </StoryFrame>
  );
}

const terminalStatuses = new Set(['completed', 'skipped', 'bypassed', 'failed']);

function InteractiveProgressStory() {
  const [sequence, setSequence] = useState(1);
  const [stages, setStages] = useState<AgenticProgressStageState[]>(() =>
    pendingStages.map(stage =>
      stage.stage === 'analyze_project'
        ? {...stage, status: 'active', eventNote: 'Inspecting the application.'}
        : stage
    )
  );
  const activeStageIndex = stages.findIndex(
    stage => stage.stage !== 'connect_mcp' && !terminalStatuses.has(stage.status ?? '')
  );
  const isComplete = activeStageIndex === -1;

  function resetProgress() {
    setStages(
      pendingStages.map(stage =>
        stage.stage === 'analyze_project'
          ? {...stage, status: 'active', eventNote: 'Inspecting the application.'}
          : stage
      )
    );
    setSequence(currentSequence => currentSequence + 1);
  }

  function updateCurrentStage(status: AgenticProgressStageState['status']) {
    if (isComplete) {
      return;
    }

    setStages(currentStages =>
      currentStages.map((stage, index) => {
        if (index === activeStageIndex) {
          if (stage.stage === 'create_project' && status === 'completed') {
            return {
              ...stage,
              status,
              eventNote: noteForStatus(status),
              extra: {projectSlugs: createdProjectSlugs},
            };
          }

          if (stage.stage === 'receive_verification_error' && status === 'completed') {
            return {
              ...stage,
              status,
              eventNote: noteForStatus(status),
              extra: {issueIds: verificationIssueIds},
            };
          }

          return {...stage, status, eventNote: noteForStatus(status)};
        }

        return stage;
      })
    );
    setSequence(currentSequence => currentSequence + 1);
  }

  function makeProgress() {
    if (isComplete) {
      resetProgress();
      return;
    }

    const currentStatus = stages[activeStageIndex]?.status;
    if (currentStatus === null) {
      updateCurrentStage('active');
      return;
    }

    updateCurrentStage(currentStatus === 'active' ? 'waiting' : 'completed');
  }

  return (
    <StoryFrame>
      <Stack gap="lg" align="start">
        <ButtonBar>
          <Button onClick={makeProgress}>{isComplete ? 'Reset' : 'Make Progress'}</Button>
          <DropdownMenu
            items={[
              {
                key: 'skip',
                label: 'Skip Step',
                onAction: () => updateCurrentStage('skipped'),
              },
              {
                key: 'fail',
                label: 'Fail Step',
                onAction: () => updateCurrentStage('failed'),
              },
              {
                key: 'bypass',
                label: 'Bypass Step',
                onAction: () => updateCurrentStage('bypassed'),
              },
            ]}
            trigger={props => (
              <Button
                {...props}
                aria-label="More progress options"
                disabled={isComplete}
                icon={<IconChevron direction="down" />}
              />
            )}
            position="bottom-end"
          />
        </ButtonBar>
        <AgenticProgress
          run={makeAgenticProgressRun({
            sequence,
            stages,
            runStatus: isComplete ? 'completed' : 'active',
          })}
        />
      </Stack>
    </StoryFrame>
  );
}

function noteForStatus(status: AgenticProgressStageState['status']) {
  switch (status) {
    case 'waiting':
      return 'Waiting for input before continuing.';
    case 'completed':
      return 'Finished this step successfully.';
    case 'skipped':
      return 'Skipped this step because it was not needed.';
    case 'failed':
      return 'Could not complete this step.';
    case 'bypassed':
      return 'Completed this step outside the normal workflow.';
    default:
      return 'Working on this step.';
  }
}

function StoryFrame({children}: {children: React.ReactNode}) {
  return (
    <Container width="100%" padding="3xl">
      {children}
    </Container>
  );
}
