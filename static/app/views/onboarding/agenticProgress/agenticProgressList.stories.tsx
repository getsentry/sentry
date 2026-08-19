import {useState} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconChevron} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

import {AgenticProgress} from './agenticProgressList';
import {AgenticProgressRunFixture} from './fixtures';
import type {AgenticProgressStageState} from './types';

const pendingStages: AgenticProgressStageState[] = [
  {stage: 'connect_mcp', status: 'completed', eventNote: null},
  {stage: 'analyze_project', status: null, eventNote: null},
  {stage: 'create_project', status: null, eventNote: null},
  {stage: 'instrument_app', status: null, eventNote: null},
  {stage: 'plan_test_error', status: null, eventNote: null},
  {stage: 'send_verification_error', status: null, eventNote: null},
  {stage: 'receive_verification_error', status: null, eventNote: null},
  {stage: 'prepare_production', status: null, eventNote: null},
  {stage: 'check_stack_trace_quality', status: null, eventNote: null},
];

const createdProjectSlugs = ['react-frontend', 'python-backend'];

export default Storybook.story('Agentic Onboarding Progress', story => {
  story('All states', () => (
    <StoryFrame>
      <AgenticProgress
        run={AgenticProgressRunFixture({
          sequence: 9,
          stages: [
            {stage: 'connect_mcp', status: 'completed', eventNote: null},
            {
              stage: 'analyze_project',
              status: 'completed',
              eventNote: 'Detected a React application using Vite.',
            },
            {
              stage: 'create_project',
              status: 'skipped',
              eventNote: 'The project already exists in this organization.',
            },
            {
              stage: 'instrument_app',
              status: 'bypassed',
              eventNote: 'Instrumentation is managed by another package.',
            },
            {
              stage: 'plan_test_error',
              status: 'failed',
              eventNote: 'Could not determine a safe path for a test error.',
            },
            {
              stage: 'send_verification_error',
              status: 'waiting',
              eventNote: 'Open the application and click “Trigger test error” to continue.',
            },
            {stage: 'receive_verification_error', status: null, eventNote: null},
            {
              stage: 'prepare_production',
              status: 'active',
              eventNote: 'Reviewing source maps and release configuration.',
            },
            {stage: 'check_stack_trace_quality', status: null, eventNote: null},
          ],
        })}
      />
    </StoryFrame>
  ));

  story('Interactive progress', () => <InteractiveProgressStory />);
});

const terminalStatuses = new Set([
  'completed',
  'skipped',
  'bypassed',
  'failed',
]);

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
          <Button onClick={makeProgress}>
            {isComplete ? 'Reset' : 'Make Progress'}
          </Button>
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
          run={AgenticProgressRunFixture({
            sequence,
            stages,
            projectSlugs:
              stages.find(stage => stage.stage === 'create_project')?.status ===
              'completed'
                ? createdProjectSlugs
                : [],
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
