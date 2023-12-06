import {Event} from 'sentry-fixture/event';
import {Group} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {Project} from 'sentry-fixture/project';
import {Repository} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';

import {CommitRow} from '../commitRow';

import {SuspectCommits} from './suspectCommits';

describe('SuspectCommits', function () {
  const organization = Organization();
  const project = Project();
  const event = Event();
  const group = Group({firstRelease: {}} as any);

  const committers = [
    {
      author: {name: 'Max Bittker', id: '1'},
      commits: [
        {
          message:
            'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
          score: 4,
          id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
          repository: Repository(),
          dateCreated: '2018-03-02T18:30:26Z',
        },
        {
          message:
            'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
          score: 4,
          id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
          repository: Repository(),
          dateCreated: '2018-03-02T18:30:26Z',
        },
      ],
    },
    {
      author: {name: 'Somebody else', id: '2'},
      commits: [
        {
          message: 'fix: Make things less broken',
          score: 2,
          id: 'zzzzzz3d0c9000829084ac7b1c9221fb18437c',
          repository: Repository(),
          dateCreated: '2018-03-02T16:30:26Z',
        },
      ],
    },
  ];

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers,
      },
    });
  });

  it('Renders base commit row', async function () {
    render(
      <SuspectCommits
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />
    );

    expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-context-commit-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('email-warning')).not.toBeInTheDocument();
  });

  it('Renders quick context commit row', async function () {
    render(
      <SuspectCommits
        project={project}
        commitRow={QuickContextCommitRow}
        eventId={event.id}
        group={group}
      />
    );

    expect(await screen.findByTestId('quick-context-commit-row')).toBeInTheDocument();
    expect(screen.queryByTestId('commit-row')).not.toBeInTheDocument();
  });

  it('renders correct heading for single commit', async () => {
    // For this one test, undo the `beforeEach` so that we can respond with just a single commit
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [committers[0]],
      },
    });

    render(
      <SuspectCommits
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />
    );

    expect(await screen.findByText(/Suspect Commit/i)).toBeInTheDocument();
    expect(screen.queryByText(/Suspect Commits/i)).not.toBeInTheDocument();
  });

  it('renders correct heading for multiple commits (and filters to unique commits)', async () => {
    render(
      <SuspectCommits
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />
    );

    // There are two commits rather than three because two of the mock commits above are the same
    expect(await screen.findByText(/Suspect Commits \(2\)/i)).toBeInTheDocument();
  });

  it('expands', async function () {
    render(
      <SuspectCommits
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />
    );

    await userEvent.click(await screen.findByText('Show more'));
    expect(screen.getAllByTestId('commit-row')).toHaveLength(2);

    // and hides
    await userEvent.click(screen.getByText('Show less'));
    expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
  });

  it('shows unassociated email warning', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [
          {
            author: {name: 'Somebody else', email: 'somebodyelse@email.com'},
            commits: [
              {
                message: 'fix: Make things less broken',
                score: 2,
                id: 'zzzzzz3d0c9000829084ac7b1c9221fb18437c',
                repository: Repository(),
                dateCreated: '2018-03-02T16:30:26Z',
              },
            ],
          },
        ],
      },
    });

    render(
      <SuspectCommits
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />
    );

    expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
    expect(screen.getByTestId('email-warning')).toBeInTheDocument();
  });
});
