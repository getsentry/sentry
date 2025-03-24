import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {TermsAndConditions} from 'getsentry/views/legalAndCompliance/termsAndConditions';

describe('TermsAndConditions', function () {
  const {organization, router, routerProps} = initializeOrg({});
  const subscription = SubscriptionFixture({organization});
  const policies = PoliciesFixture();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${subscription.slug}/policies/`,
      method: 'GET',
      body: policies,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: subscription,
    });
  });

  it('renders redesign changes', async function () {
    render(<TermsAndConditions {...routerProps} subscription={subscription} />, {
      router,
    });
    expect(await screen.findByText('Terms of Service')).toBeInTheDocument();

    // Expect no text at top of 'Terms & Conditions' section
    expect(
      screen.queryByText(/A copy of our standard terms and privacy policies/i)
    ).not.toBeInTheDocument();

    // Expect pentest to be under 'Compliance & Security' rather than 'Terms & Conditions'
    expect(
      within(screen.getByTestId('terms-and-conditions')).queryByText(
        /Penetration Test Summary/i
      )
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('compliance-and-security')).getByText(
        /Penetration Test Summary/i
      )
    ).toBeInTheDocument();
  });
});
