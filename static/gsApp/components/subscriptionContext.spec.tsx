import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import SubscriptionContext from 'getsentry/components/subscriptionContext';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('SubscriptionContext', function () {
  beforeEach(() => {
    const organization = OrganizationFixture();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [],
    });
  });

  it('render children if billing user', function () {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    render(<SubscriptionContext>Hi</SubscriptionContext>, {organization});
    expect(screen.getByText('Hi')).toBeInTheDocument();
  });
  it('renders contact billing members if not billing user', function () {
    const organization = OrganizationFixture({access: []});
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    render(<SubscriptionContext>Hi</SubscriptionContext>, {organization});
    expect(screen.queryByText('Hi')).not.toBeInTheDocument();
    expect(screen.getByText('Insufficient Access')).toBeInTheDocument();
  });
});
