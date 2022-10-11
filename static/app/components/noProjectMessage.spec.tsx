import {render, screen} from 'sentry-test/reactTestingLibrary';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('NoProjectMessage', function () {
  beforeEach(function () {
    ProjectsStore.reset();
  });

  const org = TestStubs.Organization();

  it('renders', function () {
    const organization = TestStubs.Organization({slug: 'org-slug'});
    const childrenMock = jest.fn().mockReturnValue(null);
    delete organization.projects;
    ProjectsStore.loadInitialData([]);

    render(
      <NoProjectMessage organization={organization}>{childrenMock}</NoProjectMessage>
    );

    expect(childrenMock).not.toHaveBeenCalled();
    expect(screen.getByText('Remain Calm')).toBeInTheDocument();
  });

  it('shows "Create Project" button when there are no projects', function () {
    ProjectsStore.loadInitialData([]);

    render(<NoProjectMessage organization={org} />);

    expect(screen.getByRole('button', {name: 'Create project'})).toBeInTheDocument();
  });

  it('"Create Project" is disabled when no access to `project:write`', function () {
    ProjectsStore.loadInitialData([]);

    render(<NoProjectMessage organization={TestStubs.Organization({access: []})} />);

    expect(screen.getByRole('button', {name: 'Create project'})).toBeDisabled();
  });

  it('has no "Join a Team" button when projects are missing', function () {
    ProjectsStore.loadInitialData([]);

    render(<NoProjectMessage organization={org} />);

    expect(screen.queryByRole('button', {name: 'Join a Team'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create project'})).toBeInTheDocument();
  });

  it('has a "Join a Team" button when no projects but org has projects', function () {
    ProjectsStore.loadInitialData([TestStubs.Project({hasAccess: false})]);

    render(<NoProjectMessage organization={org} />);

    expect(screen.getByRole('button', {name: 'Join a Team'})).toBeInTheDocument();
  });

  it('has a disabled "Join a Team" button if no access to `team:read`', function () {
    ProjectsStore.loadInitialData([TestStubs.Project({hasAccess: false})]);

    render(<NoProjectMessage organization={{...org, access: []}} />);

    expect(screen.getByRole('button', {name: 'Join a Team'})).toBeDisabled();
  });

  it('shows empty message to superusers that are not members', function () {
    ProjectsStore.loadInitialData([
      TestStubs.Project({hasAccess: true, isMember: false}),
    ]);

    ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser: true});

    render(
      <NoProjectMessage organization={org} superuserNeedsToBeProjectMember>
        {null}
      </NoProjectMessage>
    );

    expect(
      screen.getByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });
});
