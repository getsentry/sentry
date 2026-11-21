import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

import {MetricAlertQuotaMessage} from './metricAlertQuotaMessage';

jest.mock('getsentry/actionCreators/modal', () => ({
  openUpsellModal: jest.fn(),
}));

describe('MetricAlertQuotaMessage', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-metric-detector-limit'],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders nothing when the plan has no limit', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/metric-quota/',
      body: {count: -1, limit: -1, hasReachedLimit: false},
    });

    const {container} = render(<MetricAlertQuotaMessage />, {
      organization,
    });

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders approaching detectorLimit message with upgrade action', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/metric-quota/',
      body: {count: 9, limit: 10, hasReachedLimit: false},
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

  it('renders reached detectorLimit message with disable or remove and upgrade actions when at detectorLimit', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/metric-quota/',
      body: {count: 10, limit: 10, hasReachedLimit: true},
    });

    render(<MetricAlertQuotaMessage />, {organization});

    expect(
      await screen.findByText(/reached your plan's limit on metric monitors/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {name: /disable or remove existing monitors/i})
    ).toBeInTheDocument();

    const upgrade = screen.getByRole('button', {name: /upgrade your plan/i});
    await userEvent.click(upgrade);

    expect(openUpsellModal).toHaveBeenCalledWith({
      organization,
      source: 'metric-alert-quota',
    });
  });
});
