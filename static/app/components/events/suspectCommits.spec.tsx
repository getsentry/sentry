import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CommitRow} from 'sentry/components/commitRow';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {SuspectCommits} from './suspectCommits';

jest.mock('sentry/views/issueDetails/utils', () => ({
  ...jest.requireActual('sentry/views/issueDetails/utils'),
  useHasStreamlinedUI: jest.fn(),
}));

jest.mock('sentry/utils/analytics');

describe('SuspectCommits', () => {
  describe('SuspectCommits', () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture();
    const event = EventFixture();
    const group = GroupFixture({firstRelease: {}} as any);

    const committers = [
      {
        group_owner_id: 123,
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
        ],
      },
      {
        group_owner_id: 456,
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

    beforeEach(() => {
      jest.mocked(useHasStreamlinedUI).mockReturnValue(false);
      jest.mocked(trackAnalytics).mockClear();
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

    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('Renders base commit row', async () => {
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

    it('Renders quick context commit row', async () => {
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

    it('expands', async () => {
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

    it('shows unassociated email warning', async () => {
      MockApiClient.addMockResponse({
        method: 'GET',
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
        body: {
          committers: [
            {
              group_owner_id: 999,
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

  describe('StreamlinedSuspectCommits', () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture();
    const event = EventFixture();
    const group = GroupFixture({firstRelease: {}} as any);

    const committers = [
      {
        group_owner_id: 789,
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
        ],
      },
      {
        group_owner_id: 456,
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

    beforeEach(() => {
      (useHasStreamlinedUI as jest.Mock).mockReturnValue(true);
      jest.mocked(trackAnalytics).mockClear();
      MockApiClient.addMockResponse({
        method: 'GET',
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
        body: {
          committers: [committers[0]],
        },
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('Renders base commit row', async () => {
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

    it('Renders quick context commit row', async () => {
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
        />
      );
      expect(
        await screen.findByText('feat: Enhance suggested commits and add to alerts')
      ).toBeInTheDocument();
      expect(await screen.findByText('fix: Make things less broken')).toBeInTheDocument();
      expect(await screen.findAllByTestId('commit-row')).toHaveLength(2);
    });

    it('shows feedback component for suspect commits', async () => {
      render(
        <SuspectCommits
          projectSlug={project.slug}
          commitRow={CommitRow}
          eventId={event.id}
          group={group}
        />
      );

      expect(await screen.findByTestId('commit-row')).toBeInTheDocument();
      expect(screen.getByText('Is this correct?')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Yes, this suspect commit is correct'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'No, this suspect commit is incorrect'})
      ).toBeInTheDocument();
    });

    it('tracks analytics when feedback is submitted', async () => {
      render(
        <SuspectCommits
          projectSlug={project.slug}
          commitRow={CommitRow}
          eventId={event.id}
          group={group}
        />
      );

      const thumbsUpButton = await screen.findByRole('button', {
        name: 'Yes, this suspect commit is correct',
      });
      await userEvent.click(thumbsUpButton);

      expect(trackAnalytics).toHaveBeenCalledWith('suspect_commit.feedback_submitted', {
        choice_selected: true,
        group_owner_id: 789,
        user_id: UserFixture().id,
        organization,
      });

      expect(screen.getByText('Thanks!')).toBeInTheDocument();
    });
  });
});
