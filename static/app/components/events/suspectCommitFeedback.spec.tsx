import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import {SuspectCommitFeedback} from './suspectCommitFeedback';

jest.mock('sentry/utils/analytics');

describe('SuspectCommitFeedback', () => {
  const organization = OrganizationFixture();
  const user = UserFixture();
  const mockCommit = {
    id: 'abc123',
    message: 'fix: resolve test issue',
    group_owner_id: 12345,
    author: UserFixture({name: 'Test Author', id: 'author1'}),
    dateCreated: '2023-01-01T00:00:00Z',
    repository: RepositoryFixture({id: 'repo1', name: 'test-repo'}),
    releases: [],
  };

  beforeEach(() => {
    jest.mocked(trackAnalytics).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('tracks analytics and shows thank you message when thumbs up is clicked', async () => {
    render(<SuspectCommitFeedback commit={mockCommit} organization={organization} />);

    expect(screen.getByText('Is this correct?')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Yes, this suspect commit is correct'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'No, this suspect commit is incorrect'})
    ).toBeInTheDocument();

    const thumbsUpButton = screen.getByRole('button', {
      name: 'Yes, this suspect commit is correct',
    });
    await userEvent.click(thumbsUpButton);

    expect(trackAnalytics).toHaveBeenCalledWith('suspect_commit.feedback_submitted', {
      choice_selected: true,
      group_owner_id: 12345,
      user_id: user.id,
      organization,
    });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Thanks!')).toBeInTheDocument();
    expect(screen.queryByText('Is this correct?')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Yes, this suspect commit is correct'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'No, this suspect commit is incorrect'})
    ).not.toBeInTheDocument();
  });

  it('tracks analytics and shows thank you message when thumbs down is clicked', async () => {
    render(<SuspectCommitFeedback commit={mockCommit} organization={organization} />);

    expect(screen.getByText('Is this correct?')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Yes, this suspect commit is correct'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'No, this suspect commit is incorrect'})
    ).toBeInTheDocument();

    const thumbsDownButton = screen.getByRole('button', {
      name: 'No, this suspect commit is incorrect',
    });
    await userEvent.click(thumbsDownButton);

    expect(trackAnalytics).toHaveBeenCalledWith('suspect_commit.feedback_submitted', {
      choice_selected: false,
      group_owner_id: 12345,
      user_id: user.id,
      organization,
    });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Thanks!')).toBeInTheDocument();
    expect(screen.queryByText('Is this correct?')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Yes, this suspect commit is correct'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'No, this suspect commit is incorrect'})
    ).not.toBeInTheDocument();
  });
});
