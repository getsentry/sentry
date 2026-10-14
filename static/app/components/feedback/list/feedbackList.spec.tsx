import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FeedbackList} from 'sentry/components/feedback/list/feedbackList';
import {FeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';

describe('FeedbackList', () => {
  const organization = OrganizationFixture();

  function renderFeedbackList() {
    return render(
      <FeedbackApiOptions organization={organization}>
        <FeedbackList onItemSelect={jest.fn()} />
      </FeedbackApiOptions>,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: AutofixSetupFixture({}),
    });
  });

  it('shows an access message instead of the raw error when the request is forbidden', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      statusCode: 403,
      body: {detail: 'You do not have permission to perform this action.'},
    });

    renderFeedbackList();

    expect(
      await screen.findByText("You don't have access to this feedback")
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Teams'})).toHaveAttribute(
      'href',
      '/settings/org-slug/teams/'
    );
    expect(screen.queryByText(/^Error:/)).not.toBeInTheDocument();
  });

  it('shows a retryable error for other failures', async () => {
    const listRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    renderFeedbackList();

    expect(
      await screen.findByText('There was an error loading feedback.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Error:/)).not.toBeInTheDocument();

    const callsBeforeRetry = listRequest.mock.calls.length;
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(listRequest.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });
});
