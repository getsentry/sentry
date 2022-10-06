import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import SuggestedOwners from 'sentry/components/group/suggestedOwners/suggestedOwners';
import CommitterStore from 'sentry/stores/committerStore';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';

describe('SuggestedOwners', function () {
  const user = TestStubs.User();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event();
  const group = TestStubs.Group({firstRelease: {}});

  const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}`;

  beforeEach(function () {
    CommitterStore.init();
    TeamStore.init();
    MemberListStore.loadInitialData([user, TestStubs.CommitAuthor()]);
    Client.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/codeowners/`,
      body: [],
    });
    Client.addMockResponse({
      url: `/prompts-activity/`,
      body: {},
    });
    Client.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      query: {project: -1},
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    Client.clearMockResponses();
  });

  it('Renders suggested owners', async function () {
    Client.addMockResponse({
      url: `${endpoint}/committers/`,
      body: {
        committers: [
          {
            author: TestStubs.CommitAuthor(),
            commits: [TestStubs.Commit()],
          },
        ],
      },
    });

    Client.addMockResponse({
      url: `${endpoint}/owners/`,
      body: {
        owners: [{type: 'user', ...user}],
        rules: [[['path', 'sentry/tagstore/*'], [['user', user.email]]]],
      },
    });

    render(<SuggestedOwners project={project} group={group} event={event} />, {
      organization,
    });

    await waitFor(() =>
      expect(screen.getAllByTestId('suggested-assignee')).toHaveLength(2)
    );
    userEvent.hover(screen.getAllByTestId('suggested-assignee')[0]);
  });

  it('Merges owner matching rules and having suspect commits', async function () {
    const author = TestStubs.CommitAuthor();

    Client.addMockResponse({
      url: `${endpoint}/committers/`,
      body: {
        committers: [{author, commits: [TestStubs.Commit()]}],
      },
    });

    Client.addMockResponse({
      url: `${endpoint}/owners/`,
      body: {
        owners: [{type: 'user', ...author}],
        rules: [[['path', 'sentry/tagstore/*'], [['user', author.email]]]],
      },
    });

    render(<SuggestedOwners project={project} group={group} event={event} />, {
      organization,
    });

    userEvent.hover(await screen.findByTestId('suggested-assignee'));

    expect(await screen.findByText('sentry/tagstore/*')).toBeInTheDocument();
    expect(screen.getByText('Matching Ownership Rules')).toBeInTheDocument();
  });

  it('displays two teams when there are committers', async function () {
    const team1 = TestStubs.Team({slug: 'team-1', id: '1'});
    const team2 = TestStubs.Team({slug: 'team-2', id: '2'});
    TeamStore.loadInitialData([team1, team2], false, null);

    Client.addMockResponse({
      url: `${endpoint}/committers/`,
      body: {
        committers: [{author: TestStubs.CommitAuthor(), commits: [TestStubs.Commit()]}],
      },
    });

    Client.addMockResponse({
      url: `${endpoint}/owners/`,
      body: {
        owners: [
          {type: 'team', id: team1.id, name: team1.slug},
          {type: 'team', id: team2.id, name: team2.slug},
        ],
        rules: [[['path', 'sentry/tagstore/*'], [['team', team1.slug]]]],
      },
    });

    render(<SuggestedOwners project={project} group={group} event={event} />, {
      organization,
    });

    await waitFor(() =>
      expect(screen.getAllByTestId('suggested-assignee')).toHaveLength(3)
    );
  });

  it('displays release committers', async function () {
    const team1 = TestStubs.Team({slug: 'team-1', id: '1'});
    const team2 = TestStubs.Team({slug: 'team-2', id: '2'});
    TeamStore.loadInitialData([team1, team2], false, null);

    Client.addMockResponse({
      url: `${endpoint}/committers/`,
      body: {
        committers: [],
        releaseCommitters: [
          {
            author: TestStubs.CommitAuthor(),
            commits: [TestStubs.Commit()],
            release: TestStubs.Release(),
          },
        ],
      },
    });

    Client.addMockResponse({
      url: `${endpoint}/owners/`,
      body: {owners: [], rules: []},
    });

    render(<SuggestedOwners project={project} group={group} event={event} />, {
      organization,
    });
    userEvent.hover(await screen.findByTestId('suggested-assignee'));

    expect(await screen.findByText('Suspect Release')).toBeInTheDocument();
    expect(screen.getByText('last committed')).toBeInTheDocument();
  });
});
