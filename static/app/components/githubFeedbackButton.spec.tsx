import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';

describe('GithubFeedbackButton', function () {
  it('renders', async function () {
    render(
      <GithubFeedbackButton href="https://example.com/my-test-url">
        My button label
      </GithubFeedbackButton>
    );

    const anchor = screen.getByRole<HTMLAnchorElement>('button', {
      name: 'My button label',
    });

    // Renders a link with given href
    expect(anchor).toBeInTheDocument();
    expect(anchor.tagName).toBe('A');
    expect(anchor.href).toBe('https://example.com/my-test-url');

    // Renders tooltip
    await userEvent.hover(anchor);
    expect(await screen.findByText('Give us feedback on GitHub')).toBeInTheDocument();
  });
});
