import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AgenticProgress, AgenticProgressList} from './agenticProgressList';
import {AgenticProgressRunFixture} from './fixtures';

describe('AgenticProgressList', () => {
  it('renders every visible stage status and its notes', () => {
    render(
      <AgenticProgressList
        stages={[
          {stage: 'connect_mcp', status: 'completed', eventNote: null},
          {
            stage: 'analyze_project',
            status: 'completed',
            eventNote: 'Detected a Next.js application.',
          },
          {stage: 'create_project', status: 'bypassed', eventNote: null},
          {stage: 'instrument_app', status: 'skipped', eventNote: null},
          {
            stage: 'plan_test_error',
            status: 'failed',
            eventNote: 'Could not determine a safe test path.',
          },
          {
            stage: 'send_verification_error',
            status: 'waiting',
            eventNote: 'Open the app to trigger the error.',
          },
          {stage: 'receive_verification_error', status: null, eventNote: null},
          {stage: 'prepare_production', status: 'active', eventNote: null},
          {stage: 'check_stack_trace_quality', status: null, eventNote: null},
        ]}
      />
    );

    expect(screen.getByText('Connect agent')).toBeInTheDocument();
    expect(screen.getByText('Confirm test error')).toBeInTheDocument();
    expect(screen.getByText('Analyzing your application')).toBeInTheDocument();
    expect(screen.getByText('Detected a Next.js application.')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getAllByText('Skipped')).toHaveLength(2);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Input')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Check stack traces')).toBeInTheDocument();
  });

  it('renders send and confirmation progress as separate rows', () => {
    render(
      <AgenticProgressList
        stages={[
          {
            stage: 'send_verification_error',
            status: 'completed',
            eventNote: 'Sent the test error.',
          },
          {
            stage: 'receive_verification_error',
            status: 'active',
            eventNote: 'Waiting for Sentry to process the event.',
          },
        ]}
      />
    );

    expect(screen.getByText('Send test error')).toBeInTheDocument();
    expect(screen.getByText('Confirm test error')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Waiting for Sentry to process the event.')).toBeInTheDocument();
    expect(screen.getByText('Sent the test error.')).toBeInTheDocument();
  });

  it('renders additional stage content', () => {
    render(
      <AgenticProgressList
        stages={[{stage: 'create_project', status: 'completed', eventNote: null}]}
        extraContentByStage={{create_project: 'Created 2 projects'}}
      />
    );

    expect(screen.getByText('Created 2 projects')).toBeInTheDocument();
  });

  it('composes created projects from the run', () => {
    render(
      <AgenticProgress
        run={AgenticProgressRunFixture({
          projectSlugs: ['react-frontend', 'python-backend'],
          stages: [{stage: 'create_project', status: 'completed', eventNote: null}],
        })}
      />
    );

    expect(screen.getByText('Created 2 projects')).toBeInTheDocument();
  });
});
