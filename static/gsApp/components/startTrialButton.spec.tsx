import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import StartTrialButton from 'getsentry/components/startTrialButton';

describe('StartTrialButton', function () {
  let org: any, endpoint: any;
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    org = OrganizationFixture();
    endpoint = MockApiClient.addMockResponse({
      url: `/subscriptions/${org.slug}/`,
      method: 'GET',
      body: SubscriptionFixture({organization: org}),
    });
  });

  it('renders', async function () {
    render(
      <StartTrialButton aria-label="start trial" organization={org} source="test-abc" />
    );
    await waitFor(() => expect(endpoint).toHaveBeenCalled());

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Start trial')).toBeInTheDocument();
  });
});
