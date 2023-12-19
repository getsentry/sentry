import selectEvent from 'react-select-event';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
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
import {Project} from 'sentry/types';
import RuleBuilder from 'sentry/views/settings/project/projectOwnership/ruleBuilder';

describe('RuleBuilder', function () {
  const {organization} = initializeOrg();
  let project: Project;
  let handleAdd: jest.Mock;

  const USER_1 = User({
    id: '1',
    name: 'Jane Bloggs',
    email: 'janebloggs@example.com',
  });
  const USER_2 = User({
    id: '2',
    name: 'John Smith',
    email: 'johnsmith@example.com',
  });

  const TEAM_1 = Team({
    id: '3',
    slug: 'cool-team',
  });

  // This team is in project
  const TEAM_2 = Team({
    id: '4',
    slug: 'team-not-in-project',
  });

  beforeEach(function () {
    // User in project
    MemberListStore.loadInitialData([USER_1]);
    // All teams
    jest.spyOn(TeamStore, 'getAll').mockImplementation(() => [TEAM_1, TEAM_2]);

    handleAdd = jest.fn();

    project = ProjectFixture({
      // Teams in project
      teams: [TEAM_1],
    });
    ProjectsStore.loadInitialData([project]);
    jest.spyOn(ProjectsStore, 'getBySlug').mockImplementation(() => project);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [
        {...USER_1, user: USER_1},
        {...USER_2, user: USER_2},
      ],
    });
  });

  it('renders', async function () {
    render(
      <RuleBuilder
        project={project}
        organization={organization}
        onAddRule={handleAdd}
        paths={[]}
        urls={[]}
        disabled={false}
      />
    );

    const addButton = screen.getByRole('button', {name: 'Add rule'});

    await userEvent.click(addButton);
    expect(handleAdd).not.toHaveBeenCalled();

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Rule pattern'}),
      'some/path/*'
    );

    expect(addButton).toBeDisabled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Rule owner'}),
      'Jane Bloggs'
    );

    expect(addButton).toBeEnabled();
    await userEvent.click(addButton);
    expect(handleAdd).toHaveBeenCalled();
  });

  it('renders with suggestions', async function () {
    render(
      <RuleBuilder
        project={project}
        organization={organization}
        onAddRule={handleAdd}
        urls={['example.com/a', 'example.com/a/foo']}
        paths={['a/bar', 'a/foo']}
        disabled={false}
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
    await userEvent.click(candidates[0]);

    expect(screen.getByRole('textbox', {name: 'Rule pattern'})).toHaveValue('a/bar');

    const addButton = screen.getByRole('button', {name: 'Add rule'});
    await waitFor(() => expect(addButton).toBeEnabled());

    await userEvent.click(addButton);
    expect(handleAdd).toHaveBeenCalled();
  });

  it('builds a tag rule', async function () {
    render(
      <RuleBuilder
        project={project}
        organization={organization}
        onAddRule={handleAdd}
        paths={[]}
        urls={[]}
        disabled={false}
      />
    );

    await selectEvent.select(screen.getByText('Path'), 'Tag');
    await userEvent.type(screen.getByPlaceholderText('tag-name'), 'mytag');
    await userEvent.type(screen.getByPlaceholderText('tag-value'), 'value');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Rule owner'}),
      'Jane Bloggs'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add rule'}));

    expect(handleAdd).toHaveBeenCalledWith('tags.mytag:value janebloggs@example.com');
  });
});
