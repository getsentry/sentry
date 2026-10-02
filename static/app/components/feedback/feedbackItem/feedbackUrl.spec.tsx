import {EventFixture} from 'sentry-fixture/event';
import {FeedbackIssueFixture} from 'sentry-fixture/feedbackIssue';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {FeedbackUrl} from 'sentry/components/feedback/feedbackItem/feedbackUrl';

describe('FeedbackUrl', () => {
  const feedbackItem = FeedbackIssueFixture({});

  function renderWithUrl(url: string) {
    render(
      <FeedbackUrl
        feedbackItem={feedbackItem}
        eventData={EventFixture({contexts: {feedback: {url}}})}
      />
    );
  }

  it('opens the external link modal for an http(s) URL', async () => {
    const openModal = jest.spyOn(modal, 'openNavigateToExternalLinkModal');
    renderWithUrl('https://example.com/page');

    await userEvent.click(screen.getByDisplayValue('https://example.com/page'));

    expect(openModal).toHaveBeenCalledWith({linkText: 'https://example.com/page'});
  });

  // eslint-disable-next-line no-script-url
  it.each(['javascript:alert(document.domain)', 'data:text/html,<script>1</script>'])(
    'renders %s as plain text without offering navigation',
    async url => {
      const openModal = jest.spyOn(modal, 'openNavigateToExternalLinkModal');
      renderWithUrl(url);

      await userEvent.click(screen.getByDisplayValue(url));

      expect(openModal).not.toHaveBeenCalled();
    }
  );
});
