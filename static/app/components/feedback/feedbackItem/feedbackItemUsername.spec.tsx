import {FeedbackIssueFixture} from 'sentry-fixture/feedbackIssue';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';

describe('FeedbackItemUsername', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(''),
      },
    });
  });

  it('should fallback to "Anonymous User" when no name/contact_email exist', () => {
    const issue = FeedbackIssueFixture({
      metadata: {
        name: null,
        contact_email: null,
      },
    });
    render(<FeedbackItemUsername feedbackIssue={issue} />);

    expect(screen.getByText('Anonymous User')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should show name if that is all that exists', () => {
    const issue = FeedbackIssueFixture({
      metadata: {
        name: 'Foo Bar',
        contact_email: null,
      },
    });
    render(<FeedbackItemUsername feedbackIssue={issue} />);

    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should show contact_email if that is all that exists', () => {
    const issue = FeedbackIssueFixture({
      metadata: {
        name: null,
        contact_email: 'foo@bar.com',
      },
    });
    render(<FeedbackItemUsername feedbackIssue={issue} />);

    expect(screen.getByText('foo@bar.com')).toBeInTheDocument();

    const mailtoButton = screen.getByRole('button');
    expect(mailtoButton).toHaveAttribute('aria-label', 'Email foo@bar.com');
    expect(mailtoButton).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:foo@bar.com')
    );
  });

  it('should show both name and contact_email if they are set', () => {
    const issue = FeedbackIssueFixture({
      metadata: {
        name: 'Foo Bar',
        contact_email: 'foo@bar.com',
      },
    });
    render(<FeedbackItemUsername feedbackIssue={issue} />);

    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
    expect(screen.getByText('foo@bar.com')).toBeInTheDocument();

    const mailtoButton = screen.getByRole('button');
    expect(mailtoButton).toHaveAttribute('aria-label', 'Email Foo Bar <foo@bar.com>');
    expect(mailtoButton).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:foo@bar.com')
    );
  });

  it('should not show duplicate name & contact_email if they are the same value', () => {
    const issue = FeedbackIssueFixture({
      metadata: {
        name: 'foo@bar.com',
        contact_email: 'foo@bar.com',
      },
    });
    render(<FeedbackItemUsername feedbackIssue={issue} />);

    expect(screen.getAllByText('foo@bar.com')).toHaveLength(1);

    const mailtoButton = screen.getByRole('button');
    expect(mailtoButton).toHaveAttribute('aria-label', 'Email foo@bar.com');
    expect(mailtoButton).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:foo@bar.com')
    );
  });

  it('should copy text and select it on click', async () => {
    const issue = FeedbackIssueFixture({
      metadata: {
        name: 'Foo Bar',
        contact_email: 'foo@bar.com',
      },
    });
    render(<FeedbackItemUsername feedbackIssue={issue} />);

    const username = screen.getByText('Foo Bar');

    await userEvent.click(username);

    await waitFor(() => {
      expect(window.getSelection()?.toString()).toBe('Foo Bar•foo@bar.com');
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Foo Bar <foo@bar.com>');
  });
});
