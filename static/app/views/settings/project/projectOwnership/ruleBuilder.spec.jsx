import selectEvent from 'react-select-event';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import RuleBuilder from 'sentry/views/settings/project/projectOwnership/ruleBuilder';

describe('RuleBuilder', function () {
  const organization = TestStubs.Organization();
  let project;
  let handleAdd;
  const USER_1 = TestStubs.User({
    id: '1',
    name: 'Jane Bloggs',
    email: 'janebloggs@example.com',
    user: {
      id: '1',
      name: 'Jane Bloggs',
      email: 'janebloggs@example.com',
    },
  });
  const USER_2 = TestStubs.User({
    id: '2',
    name: 'John Smith',
    email: 'johnsmith@example.com',
    user: {
      id: '2',
      name: 'John Smith',
      email: 'johnsmith@example.com',
    },
  });

  const TEAM_1 = TestStubs.Team({
    id: '3',
    slug: 'cool-team',
  });

  // This team is in project
  const TEAM_2 = TestStubs.Team({
    id: '4',
    slug: 'team-not-in-project',
  });

  beforeEach(function () {
    // User in project
    MemberListStore.loadInitialData([USER_1]);
    // All teams
    jest.spyOn(TeamStore, 'getAll').mockImplementation(() => [TEAM_1, TEAM_2]);

    handleAdd = jest.fn();

    project = TestStubs.Project({
      // Teams in project
      teams: [TEAM_1],
    });
    ProjectsStore.loadInitialData([project]);
    jest.spyOn(ProjectsStore, 'getBySlug').mockImplementation(() => project);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [USER_1, USER_2],
    });
  });

  it('renders', async function () {
    const {container} = render(
      <RuleBuilder project={project} organization={organization} onAddRule={handleAdd} />
    );

    const addButton = screen.getByRole('button', {name: 'Add rule'});

    userEvent.click(addButton);
    expect(handleAdd).not.toHaveBeenCalled();

    userEvent.type(screen.getByRole('textbox', {name: 'Rule pattern'}), 'some/path/*');

    expect(addButton).toBeDisabled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Rule owner'}),
      'Jane Bloggs'
    );

    expect(addButton).toBeEnabled();
    userEvent.click(addButton);
    expect(handleAdd).toHaveBeenCalled();

    expect(container).toSnapshot();
  });

  it('renders with suggestions', async function () {
    const {container} = render(
      <RuleBuilder
        project={project}
        organization={organization}
        onAddRule={handleAdd}
        urls={['example.com/a', 'example.com/a/foo']}
        paths={['a/bar', 'a/foo']}
      />
    );

    // Open the menu so we can do some assertions.
    const ownerInput = screen.getByRole('textbox', {name: 'Rule owner'});
    selectEvent.openMenu(ownerInput);

    await waitForElementToBeRemoved(() => screen.queryByText('Loading...'));

    expect(screen.getByText('Jane Bloggs')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('#cool-team')).toBeInTheDocument();
    expect(screen.getByText('#team-not-in-project')).toBeInTheDocument();

    // TODO Check that the last two are disabled

    // Enter to select Jane Bloggs
    await selectEvent.select(ownerInput, 'Jane Bloggs');

    const candidates = screen.getAllByRole('button', {name: 'Path rule candidate'});
    userEvent.click(candidates[0]);

    expect(screen.getByRole('textbox', {name: 'Rule pattern'})).toHaveValue('a/bar');

    const addButton = screen.getByRole('button', {name: 'Add rule'});
    await waitFor(() => expect(addButton).toBeEnabled());

    expect(container).toSnapshot();

    userEvent.click(addButton);
    expect(handleAdd).toHaveBeenCalled();
  });
});
