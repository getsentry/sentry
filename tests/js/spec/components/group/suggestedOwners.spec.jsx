import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import SuggestedOwners from 'sentry/components/group/suggestedOwners/suggestedOwners';
import CommitterStore from 'sentry/stores/committerStore';
import MemberListStore from 'sentry/stores/memberListStore';

describe('SuggestedOwners', function () {
  const user = TestStubs.User();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event();
  const group = TestStubs.Group({firstRelease: {}});

  const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}`;

  beforeEach(function () {
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
    act(() => CommitterStore.reset());
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

  it('does not call committers endpoint if `group.firstRelease` does not exist', async function () {
    const committers = Client.addMockResponse({
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

    render(
      <SuggestedOwners project={project} group={TestStubs.Group()} event={event} />,
      {organization}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(committers).not.toHaveBeenCalled();
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
});
