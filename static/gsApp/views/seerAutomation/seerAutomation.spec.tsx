import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import SeerAutomation from 'getsentry/views/seerAutomation/seerAutomation';

describe('SeerAutomation', () => {
  beforeEach(() => {
    const organization = OrganizationFixture();
    SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}));
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/onboarding-check/',
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      method: 'GET',
      body: [],
    });
  });

  it('does not show legacy banner for orgs without legacy or beta Seer features', () => {
    const organization = OrganizationFixture({
      features: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: false,
        isCodeReviewEnabled: false,
        isSeerConfigured: false,
      },
    });

    render(<SeerAutomation />, {organization});

    expect(
      screen.queryByText('You are using an older Seer experience.')
    ).not.toBeInTheDocument();
  });
});
