import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

import {MetricAlertQuotaMessage} from './metricAlertQuotaMessage';

jest.mock('getsentry/actionCreators/modal', () => ({
  openUpsellModal: jest.fn(),
}));

describe('MetricAlertQuotaMessage', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-metric-detector-limit', 'workflow-engine-ui'],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when subscription has unlimited quota', async () => {
    const subscription = SubscriptionFixture({
      organization,
      planDetails: {
        ...SubscriptionFixture({
          organization,
        }).planDetails,
        metricDetectorLimit: -1,
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    const {container} = render(<MetricAlertQuotaMessage />, {
      organization,
    });

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders approaching detectorLimit message with upgrade action', async () => {
    const subscription = SubscriptionFixture({
      organization,
      planDetails: {
        ...SubscriptionFixture({
          organization,
        }).planDetails,
        metricDetectorLimit: 10,
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '9'},
      body: [],
    });

    render(<MetricAlertQuotaMessage />, {organization});

    expect(await screen.findByText(/used 9 of 10 metric monitors/i)).toBeInTheDocument();

    const upgrade = screen.getByRole('button', {name: /upgrade your plan/i});
    await userEvent.click(upgrade);

    expect(openUpsellModal).toHaveBeenCalledWith({
      organization,
      source: 'metric-alert-quota',
    });
  });

  it('renders reached detectorLimit message with remove and upgrade actions when at detectorLimit', async () => {
    const subscription = SubscriptionFixture({
      organization,
      planDetails: {
        ...SubscriptionFixture({
          organization,
        }).planDetails,
        metricDetectorLimit: 10,
      },
    });

    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '10'},
      body: [],
    });

    // Mock alert-rules endpoint to prevent console errors
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      headers: {'X-Hits': '0'},
      body: [],
    });

    render(<MetricAlertQuotaMessage />, {organization});

    expect(
      await screen.findByText(/reached your plan's limit on metric monitors/i)
    ).toBeInTheDocument();

    // Remove link and upgrade button are present
    expect(
      screen.getByRole('link', {name: /remove existing monitors/i})
    ).toBeInTheDocument();

    const upgrade = screen.getByRole('button', {name: /upgrade your plan/i});
    await userEvent.click(upgrade);

    expect(openUpsellModal).toHaveBeenCalledWith({
      organization,
      source: 'metric-alert-quota',
    });
  });
});
