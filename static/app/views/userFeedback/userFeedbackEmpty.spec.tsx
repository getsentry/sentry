import {Project as ProjectFixture} from 'sentry-fixture/project';

import {reactHooks, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {UserFeedbackEmpty} from 'sentry/views/userFeedback/userFeedbackEmpty';

describe('UserFeedbackEmpty', function () {
  const project = ProjectFixture({id: '1'});
  const projectWithReports = ProjectFixture({id: '2', hasUserReports: true});
  const projectWithoutReports = ProjectFixture({id: '3'});

  it('renders empty', function () {
    render(<UserFeedbackEmpty />);
  });

  it('renders landing for project with no user feedback', function () {
    reactHooks.act(() => void ProjectsStore.loadInitialData([project]));

    render(<UserFeedbackEmpty />);

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });

  it('renders warning for project with any user feedback', function () {
    reactHooks.act(() => void ProjectsStore.loadInitialData([projectWithReports]));

    render(<UserFeedbackEmpty />);

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders warning for projects with any user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithReports])
    );

    render(<UserFeedbackEmpty />);

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders warning for project query with user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithReports])
    );

    render(<UserFeedbackEmpty projectIds={[projectWithReports.id]} />);

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders landing for project query without any user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithReports])
    );

    render(<UserFeedbackEmpty projectIds={[project.id]} />);

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });

  it('renders warning for multi project query with any user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithReports])
    );

    render(<UserFeedbackEmpty projectIds={[project.id, projectWithReports.id]} />);

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders landing for multi project query without any user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithoutReports])
    );

    render(<UserFeedbackEmpty projectIds={[project.id, projectWithoutReports.id]} />);

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });
});
