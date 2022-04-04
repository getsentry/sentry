import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventCause from 'sentry/components/events/eventCause';
import {CommittersProvider} from 'sentry/stores/Commiters/CommittersContext';

describe('EventCause', function () {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event();
  const group = TestStubs.Group({firstRelease: {}});

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [
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
        ],
      },
    });
  });

  it('renders', async function () {
    render(
      <CommittersProvider>
        <EventCause
          organization={organization}
          project={project}
          event={event}
          group={group}
        />
      </CommittersProvider>
    );

    expect(await screen.findByTestId(/commit-row/)).toBeInTheDocument();
  });

  it('expands and hides commits', async function () {
    render(
      <CommittersProvider>
        <EventCause
          organization={organization}
          project={project}
          event={event}
          group={group}
        />
      </CommittersProvider>
    );

    userEvent.click(await screen.findByText(/Show more/));
    expect(await screen.findAllByTestId(/commit-row/)).toHaveLength(2);

    userEvent.click(await screen.findByText(/Show less/));
    expect(await screen.findByTestId(/commit-row/)).toBeInTheDocument();
  });
});
