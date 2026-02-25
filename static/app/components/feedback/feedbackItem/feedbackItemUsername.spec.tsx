import {FeedbackIssueFixture} from 'sentry-fixture/feedbackIssue';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';

describe('FeedbackItemUsername', () => {
  let seerSetupMock: any;

  const mockSeerSetup = () => {
    return MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: {
        billing: {
          hasAutofixQuota: false,
          hasScannerQuota: false,
        },
      },
    });
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    seerSetupMock = mockSeerSetup();

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

  describe('AI summary functionality', () => {
    it('should display summary and include it in email subject when AI summary is enabled', async () => {
      seerSetupMock = mockSeerSetup();

      const issue = FeedbackIssueFixture({
        metadata: {
          name: 'Foo Bar',
          contact_email: 'foo@bar.com',
          summary: 'Login issue with payment flow',
        },
      });

      render(<FeedbackItemUsername feedbackIssue={issue} />, {
        organization: {
          features: ['gen-ai-features'],
        },
      });

      await waitFor(() => {
        expect(seerSetupMock).toHaveBeenCalled();
      });

      expect(screen.getByText('Login issue with payment flow')).toBeInTheDocument();

      const mailtoButton = screen.getByRole('button');
      expect(mailtoButton).toHaveAttribute(
        'href',
        expect.stringContaining('Login%20issue%20with%20payment%20flow')
      );
    });

    it.each([
      {
        description: 'AI features are disabled',
        features: [] as string[],
        summary: 'Login issue with payment flow',
      },
      {
        description: 'AI features enabled but summary is null',
        features: ['gen-ai-features'],
        summary: null,
      },
    ])(
      'should not display summary or include it in email subject when $description',
      async ({features, summary}) => {
        seerSetupMock = mockSeerSetup();

        const issue = FeedbackIssueFixture({
          metadata: {
            name: 'Foo Bar',
            contact_email: 'foo@bar.com',
            summary,
          },
        });

        render(<FeedbackItemUsername feedbackIssue={issue} />, {
          organization: {
            features,
          },
        });

        await waitFor(() => {
          expect(seerSetupMock).toHaveBeenCalled();
        });

        if (summary) {
          expect(screen.queryByText(summary)).not.toBeInTheDocument();
        }

        const mailtoButton = screen.getByRole('button');
        expect(mailtoButton).toHaveAttribute(
          'href',
          expect.not.stringContaining('Login%20issue%20with%20payment%20flow')
        );
      }
    );
  });
});
