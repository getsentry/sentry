import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrgStatsBanner from 'getsentry/hooks/orgStatsBanner';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('OrgStatsBanner', function () {
  let wrapper: any;

  afterEach(function () {
    jest.clearAllMocks();
    if (wrapper) {
      wrapper.unmount();
    }
    wrapper = null;
  });

  it('renders empty if not self serve', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    wrapper = render(<OrgStatsBanner organization={organization} />);
    expect(wrapper.container).toBeEmptyDOMElement();
  });

  it('renders increase event limit CTA for billing user', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    wrapper = render(<OrgStatsBanner organization={organization} />);
    expect(screen.getByText('Increase Reserved Limits')).toBeInTheDocument();
    expect(screen.getByText('Increase your Reserved Quotas')).toBeInTheDocument();
  });

  it('renders request increase event limit CTA for non-billing user', function () {
    const organization = OrganizationFixture({});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    wrapper = render(<OrgStatsBanner organization={organization} />);
    expect(screen.getByText('Request Additional Quota')).toBeInTheDocument();
    expect(
      screen.getByText('Request an Increase to Reserved Limits')
    ).toBeInTheDocument();
  });

  it('renders start trial for billing user', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
      canTrial: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    wrapper = render(<OrgStatsBanner organization={organization} />);
    expect(screen.getByText('Start Trial')).toBeInTheDocument();
    expect(screen.getByText('Try Sentry Business for Free')).toBeInTheDocument();
  });

  it('renders upgrade for billing user', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
      canTrial: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    wrapper = render(<OrgStatsBanner organization={organization} />);
    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
    expect(screen.getByText('Upgrade to Business')).toBeInTheDocument();
  });

  it('renders request upgrade for non-billing user', function () {
    const organization = OrganizationFixture({});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
      canTrial: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    wrapper = render(<OrgStatsBanner organization={organization} />);
    expect(screen.getByText('Request Upgrade')).toBeInTheDocument();
    expect(screen.getByText('Request an Upgrade to Business')).toBeInTheDocument();
  });
});
