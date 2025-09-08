import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useUser} from 'sentry/utils/useUser';

import {SuspectCommitFeedback} from './suspectCommitFeedback';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/utils/useUser');

describe('SuspectCommitFeedback', () => {
  const organization = OrganizationFixture();
  const user = UserFixture();
  const mockCommit = {
    id: 'abc123',
    message: 'fix: resolve test issue',
    group_owner_id: 12345,
    author: {name: 'Test Author', id: 'author1'},
    dateCreated: '2023-01-01T00:00:00Z',
    repository: {id: 'repo1', name: 'test-repo'},
  };

  beforeEach(() => {
    jest.mocked(useUser).mockReturnValue(user);
    jest.mocked(trackAnalytics).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders feedback UI correctly', () => {
    render(<SuspectCommitFeedback commit={mockCommit} organization={organization} />);

    expect(screen.getByText('Is this correct?')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Yes, this suspect commit is correct'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'No, this suspect commit is incorrect'})
    ).toBeInTheDocument();
  });

  it('tracks analytics when thumbs up is clicked', async () => {
    render(<SuspectCommitFeedback commit={mockCommit} organization={organization} />);

    const thumbsUpButton = screen.getByRole('button', {
      name: 'Yes, this suspect commit is correct',
    });
    await userEvent.click(thumbsUpButton);

    expect(trackAnalytics).toHaveBeenCalledWith('suspect-commit.feedback-submitted', {
      choice_selected: true,
      group_owner_id: 12345,
      user_id: user.id,
      organization,
    });
  });

  it('tracks analytics when thumbs down is clicked', async () => {
    render(<SuspectCommitFeedback commit={mockCommit} organization={organization} />);

    const thumbsDownButton = screen.getByRole('button', {
      name: 'No, this suspect commit is incorrect',
    });
    await userEvent.click(thumbsDownButton);

    expect(trackAnalytics).toHaveBeenCalledWith('suspect-commit.feedback-submitted', {
      choice_selected: false,
      group_owner_id: 12345,
      user_id: user.id,
      organization,
    });
  });

  it('shows thank you message after feedback is submitted', async () => {
    render(<SuspectCommitFeedback commit={mockCommit} organization={organization} />);

    const thumbsUpButton = screen.getByRole('button', {
      name: 'Yes, this suspect commit is correct',
    });
    await userEvent.click(thumbsUpButton);

    expect(screen.getByText('Thanks!')).toBeInTheDocument();
    expect(screen.queryByText('Is this correct?')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Yes, this suspect commit is correct'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'No, this suspect commit is incorrect'})
    ).not.toBeInTheDocument();
  });

  it('only allows one feedback submission', async () => {
    render(<SuspectCommitFeedback commit={mockCommit} organization={organization} />);

    const thumbsUpButton = screen.getByRole('button', {
      name: 'Yes, this suspect commit is correct',
    });
    await userEvent.click(thumbsUpButton);

    // Should show thanks message
    expect(screen.getByText('Thanks!')).toBeInTheDocument();

    // Analytics should only be called once
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    // Buttons should no longer be available for clicking
    expect(
      screen.queryByRole('button', {name: 'Yes, this suspect commit is correct'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'No, this suspect commit is incorrect'})
    ).not.toBeInTheDocument();
  });
});
