import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';

describe('GithubFeedbackButton', function () {
  it('renders', async function () {
    render(<GithubFeedbackButton href="https://example.com/my-test-url" />);

    const anchor = screen.getByRole<HTMLAnchorElement>('button', {
      name: 'Give Feedback',
    });

    // Renders a link with given href
    expect(anchor).toBeInTheDocument();
    expect(anchor.tagName).toBe('A');
    expect(anchor.href).toBe('https://example.com/my-test-url');

    // Renders tooltip
    await userEvent.hover(anchor);
    expect(await screen.findByText('Give us feedback on GitHub')).toBeInTheDocument();
  });

  it('renders with custom label', function () {
    render(
      <GithubFeedbackButton href="https://example.com/my-test-url" label="My label" />
    );

    expect(
      screen.getByRole<HTMLAnchorElement>('button', {
        name: 'My label',
      })
    ).toBeInTheDocument();
  });

  it('renders without label', function () {
    render(<GithubFeedbackButton href="https://example.com/my-test-url" label={null} />);

    // Renders button without text content
    const button = screen.getByRole<HTMLAnchorElement>('button', {
      name: 'Give Feedback',
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('');
    expect(button).toHaveAttribute('aria-label', 'Give Feedback');
  });
});
