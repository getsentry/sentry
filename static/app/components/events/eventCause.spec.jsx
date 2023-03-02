import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {EventCause} from 'sentry/components/events/eventCause';

import {CommitRow} from '../commitRow';
import {QuickContextCommitRow} from '../discover/quickContextCommitRow';

describe('EventCause', function () {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event();
  const group = TestStubs.Group({firstRelease: {}});

  const committers = [
    {
      author: {name: 'Max Bittker', id: '1'},
      commits: [
        {
          message:
            'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
          score: 4,
          id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
          repository: TestStubs.Repository(),
          dateCreated: '2018-03-02T18:30:26Z',
        },
        {
          message:
            'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
          score: 4,
          id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
          repository: TestStubs.Repository(),
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
          repository: TestStubs.Repository(),
          dateCreated: '2018-03-02T16:30:26Z',
        },
      ],
    },
  ];

  afterEach(function () {
    Client.clearMockResponses();
  });

  beforeEach(function () {
    Client.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers,
      },
    });
  });

  it('Renders base commit row', async function () {
    render(
      <EventCause
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-context-commit-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('email-warning')).not.toBeInTheDocument();
  });

  it('Renders quick context commit row', async function () {
    render(
      <EventCause
        project={project}
        commitRow={QuickContextCommitRow}
        eventId={event.id}
        group={group}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByTestId('quick-context-commit-row')).toBeInTheDocument();
    expect(screen.queryByTestId('commit-row')).not.toBeInTheDocument();
  });

  it('renders correct heading for single commit', async () => {
    // For this one test, undo the `beforeEach` so that we can respond with just a single commit
    Client.clearMockResponses();
    Client.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [committers[0]],
      },
    });

    render(
      <EventCause
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText(/Suspect Commit/i)).toBeInTheDocument();
    expect(screen.queryByText(/Suspect Commits/i)).not.toBeInTheDocument();
  });

  it('renders correct heading for multiple commits (and filters to unique commits)', async () => {
    render(
      <EventCause
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />,
      {
        organization,
      }
    );

    // There are two commits rather than three because two of the mock commits above are the same
    expect(await screen.findByText(/Suspect Commits \(2\)/i)).toBeInTheDocument();
  });

  it('expands', async function () {
    render(
      <EventCause
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />,
      {
        organization,
      }
    );

    userEvent.click(await screen.findByText('Show more'));
    expect(screen.getAllByTestId('commit-row')).toHaveLength(2);

    // and hides
    userEvent.click(screen.getByText('Show less'));
    expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
  });

  it('shows unassociated email warning', async function () {
    Client.addMockResponse({
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
                repository: TestStubs.Repository(),
                dateCreated: '2018-03-02T16:30:26Z',
              },
            ],
          },
        ],
      },
    });

    render(
      <EventCause
        project={project}
        commitRow={CommitRow}
        eventId={event.id}
        group={group}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
    expect(screen.getByTestId('email-warning')).toBeInTheDocument();
  });
});
