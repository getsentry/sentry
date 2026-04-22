import * as Sentry from '@sentry/react';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {DEMO_CRASH_REPORT_MODAL_DSN} from 'sentry/utils/openDemoCrashReportModal';
import {FeedbackEmptyState} from 'sentry/views/feedback/feedbackEmptyState';

describe('FeedbackEmptyState', () => {
  const project = ProjectFixture({id: '1'});
  const projectWithReports = ProjectFixture({id: '2', hasUserReports: true});
  const projectWithoutReports = ProjectFixture({id: '3'});

  it('renders empty', () => {
    render(<FeedbackEmptyState />);
  });

  it('renders landing for project with no user feedback', () => {
    act(() => ProjectsStore.loadInitialData([project]));

    render(<FeedbackEmptyState />);

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });

  it('renders warning for project with any user feedback', () => {
    act(() => ProjectsStore.loadInitialData([projectWithReports]));

    render(<FeedbackEmptyState />);

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders warning for projects with any user feedback', () => {
    act(() => ProjectsStore.loadInitialData([project, projectWithReports]));

    render(<FeedbackEmptyState />);

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders warning for project query with user feedback', () => {
    act(() => ProjectsStore.loadInitialData([project, projectWithReports]));

    render(<FeedbackEmptyState projectIds={[projectWithReports.id]} />);

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders landing for project query without any user feedback', () => {
    act(() => ProjectsStore.loadInitialData([project, projectWithReports]));

    render(<FeedbackEmptyState projectIds={[project.id]} />);

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });

  it('renders warning for multi project query with any user feedback', () => {
    act(() => ProjectsStore.loadInitialData([project, projectWithReports]));

    render(<FeedbackEmptyState projectIds={[project.id, projectWithReports.id]} />);

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders landing for multi project query without any user feedback', () => {
    act(() => ProjectsStore.loadInitialData([project, projectWithoutReports]));

    render(<FeedbackEmptyState projectIds={[project.id, projectWithoutReports.id]} />);

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });

  it('opens the crash report modal example with the demo dsn', async () => {
    act(() => ProjectsStore.loadInitialData([project]));

    render(<FeedbackEmptyState />);

    await userEvent.click(screen.getByRole('button', {name: 'See an example'}));

    expect(Sentry.showReportDialog).toHaveBeenCalledWith({
      dsn: DEMO_CRASH_REPORT_MODAL_DSN,
      eventId: '00000000000000000000000000000000',
    });
  });
});
