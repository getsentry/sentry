import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GithubFeedbackTooltip} from 'sentry/components/githubFeedbackTooltip';

describe('GithubFeedbackTooltip', function () {
  it('renders', async function () {
    render(
      <GithubFeedbackTooltip
        title="My custom title text"
        href="https://example.com/my-test-url"
      >
        <span data-test-id="anchor" />
      </GithubFeedbackTooltip>
    );

    const anchor = screen.getByTestId('anchor');
    await userEvent.hover(anchor);

    // Renders custom title text
    expect(await screen.findByText('My custom title text')).toBeInTheDocument();

    // Renders link with given href
    const link = screen.getByRole<HTMLAnchorElement>('link', {name: 'GitHub'});
    expect(link).toBeInTheDocument();
    expect(link.href).toBe('https://example.com/my-test-url');
  });
});
