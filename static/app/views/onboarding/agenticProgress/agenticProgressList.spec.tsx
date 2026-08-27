import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {AgenticProgress, AgenticProgressList} from './agenticProgressList';

describe('AgenticProgressList', () => {
  it('renders header content', () => {
    render(<AgenticProgressList stages={[]} header="Progress header" />);

    expect(screen.getByText('Progress header')).toBeInTheDocument();
  });

  it('renders every visible stage status and its notes', () => {
    render(
      <AgenticProgressList
        stages={[
          {stage: 'connect_mcp', status: 'completed', eventNote: null, extra: null},
          {
            stage: 'analyze_project',
            status: 'completed',
            eventNote: 'Detected a Next.js application.',
            extra: null,
          },
          {stage: 'create_project', status: 'bypassed', eventNote: null, extra: null},
          {stage: 'instrument_app', status: 'skipped', eventNote: null, extra: null},
          {
            stage: 'plan_test_error',
            status: 'failed',
            eventNote: 'Could not determine a safe test path.',
            extra: null,
          },
          {
            stage: 'send_verification_error',
            status: 'waiting',
            eventNote: 'Open the app to trigger the error.',
            extra: null,
          },
          {
            stage: 'receive_verification_error',
            status: null,
            eventNote: null,
            extra: null,
          },
          {stage: 'prepare_production', status: 'active', eventNote: null, extra: null},
          {
            stage: 'check_stack_trace_quality',
            status: null,
            eventNote: null,
            extra: null,
          },
        ]}
      />
    );

    expect(screen.getByText('Connect agent')).toBeInTheDocument();
    expect(screen.getByText('Confirm test error')).toBeInTheDocument();
    expect(screen.getByText('Analyzing your application')).toBeInTheDocument();
    expect(screen.getByText('Detected a Next.js application.')).toBeInTheDocument();
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByText('Bypassed')).toBeInTheDocument();
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
            extra: null,
          },
          {
            stage: 'receive_verification_error',
            status: 'active',
            eventNote: 'Waiting for Sentry to process the event.',
            extra: null,
          },
        ]}
      />
    );

    expect(screen.getByText('Send test error')).toBeInTheDocument();
    expect(screen.getByText('Confirm test error')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(
      screen.getByText('Waiting for Sentry to process the event.')
    ).toBeInTheDocument();
    expect(screen.getByText('Sent the test error.')).toBeInTheDocument();
  });

  it('renders additional stage content', () => {
    render(
      <AgenticProgressList
        stages={[
          {stage: 'create_project', status: 'completed', eventNote: null, extra: null},
        ]}
        extraContentByStage={{create_project: 'Created 2 projects'}}
      />
    );

    expect(screen.getByText('Created 2 projects')).toBeInTheDocument();
  });

  it('composes created projects from the run', async () => {
    const projectsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [
        ProjectFixture({slug: 'react-frontend'}),
        ProjectFixture({slug: 'python-backend'}),
      ],
    });

    render(
      <AgenticProgress
        run={AgenticProgressRunFixture({
          stages: [
            {
              stage: 'create_project',
              status: 'completed',
              eventNote: null,
              extra: {projectSlugs: ['react-frontend', 'python-backend']},
            },
          ],
        })}
      />
    );

    expect(screen.getByText('Created 2 projects')).toBeInTheDocument();
    expect(screen.getByText('Agent Connected')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your agent is setting up Sentry in your application. For now, you’re off the hook. Sit back and let it do the work.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Last update/)).toBeInTheDocument();
    expect(screen.getByText('ID:Lg1iSt2qeQ')).toBeInTheDocument();
    await waitFor(() => expect(projectsRequest).toHaveBeenCalled());
  });
});
