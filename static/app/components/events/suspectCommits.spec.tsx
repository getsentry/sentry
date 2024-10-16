import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';

import {CommitRow} from '../commitRow';

import {SuspectCommits} from './suspectCommits';

describe('SuspectCommits', function () {
  describe('SuspectCommits', function () {
    const organization = OrganizationFixture();
    const project = ProjectFixture();
    const event = EventFixture();
    const group = GroupFixture({firstRelease: {}} as any);

    const committers = [
      {
        author: {name: 'Max Bittker', id: '1'},
        commits: [
          {
            message:
              'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
            score: 4,
            id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
            repository: RepositoryFixture(),
            dateCreated: '2018-03-02T18:30:26Z',
          },
          {
            message:
              'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
            score: 4,
            id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
            repository: RepositoryFixture(),
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
            repository: RepositoryFixture(),
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
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [project],
      });
    });

    it('Renders base commit row', async function () {
      render(
        <SuspectCommits
          projectSlug={project.slug}
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
          projectSlug={project.slug}
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
          projectSlug={project.slug}
          commitRow={CommitRow}
          eventId={event.id}
          group={group}
        />
      );

      expect(await screen.findByText(/Suspect Commit/i)).toBeInTheDocument();
      expect(screen.queryByText(/Suspect Commits/i)).not.toBeInTheDocument();
    });

    it('expands', async function () {
      render(
        <SuspectCommits
          projectSlug={project.slug}
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
                  repository: RepositoryFixture(),
                  dateCreated: '2018-03-02T16:30:26Z',
                },
              ],
            },
          ],
        },
      });

      render(
        <SuspectCommits
          projectSlug={project.slug}
          commitRow={CommitRow}
          eventId={event.id}
          group={group}
        />
      );

      expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
      expect(screen.getByTestId('email-warning')).toBeInTheDocument();
    });
  });

  describe('StreamlinedSuspectCommits', function () {
    const organization = OrganizationFixture({features: ['issue-details-streamline']});
    const project = ProjectFixture();
    const event = EventFixture();
    const group = GroupFixture({firstRelease: {}} as any);
    const location = LocationFixture({query: {streamline: '1'}});

    const committers = [
      {
        author: {name: 'Max Bittker', id: '1'},
        commits: [
          {
            message:
              'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
            score: 4,
            id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
            repository: RepositoryFixture(),
            dateCreated: '2018-03-02T18:30:26Z',
          },
          {
            message:
              'feat: Enhance suggested commits and add to alerts\n\n- Refactor components to use new shared CommitRow\n- Add Suspect Commits to alert emails\n- Refactor committers scanning code to handle various edge cases.',
            score: 4,
            id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
            repository: RepositoryFixture(),
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
            repository: RepositoryFixture(),
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
          committers: [committers[0]],
        },
      });
    });

    it('Renders base commit row', async function () {
      render(
        <SuspectCommits
          projectSlug={project.slug}
          commitRow={CommitRow}
          eventId={event.id}
          group={group}
        />,
        {router: {location}}
      );

      expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
      expect(screen.queryByTestId('quick-context-commit-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('email-warning')).not.toBeInTheDocument();
    });

    it('Renders quick context commit row', async function () {
      render(
        <SuspectCommits
          projectSlug={project.slug}
          commitRow={QuickContextCommitRow}
          eventId={event.id}
          group={group}
        />,
        {router: {location}}
      );

      expect(await screen.findByTestId('quick-context-commit-row')).toBeInTheDocument();
      expect(screen.queryByTestId('commit-row')).not.toBeInTheDocument();
    });

    it('renders multiple suspect commits', async () => {
      MockApiClient.addMockResponse({
        method: 'GET',
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
        body: {
          committers,
        },
      });
      render(
        <SuspectCommits
          projectSlug={project.slug}
          commitRow={CommitRow}
          eventId={event.id}
          group={group}
        />,
        {router: {location}}
      );
      expect(
        await screen.findByText('feat: Enhance suggested commits and add to alerts')
      ).toBeInTheDocument();
      expect(await screen.findByText('fix: Make things less broken')).toBeInTheDocument();
      expect(await screen.findAllByTestId('commit-row')).toHaveLength(2);
    });
  });
});
