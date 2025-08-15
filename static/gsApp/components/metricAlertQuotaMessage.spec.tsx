import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {useMetricDetectorLimit} from 'getsentry/hooks/useMetricDetectorLimit';

import {MetricAlertQuotaMessage} from './metricAlertQuotaMessage';

jest.mock('getsentry/hooks/useMetricDetectorLimit', () => ({
  useMetricDetectorLimit: jest.fn(),
}));

jest.mock('getsentry/actionCreators/modal', () => ({
  openUpsellModal: jest.fn(),
}));

const mockUseMetricDetectorLimit = useMetricDetectorLimit as unknown as jest.Mock;

describe('MetricAlertQuotaMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when hook returns null', () => {
    mockUseMetricDetectorLimit.mockReturnValue(null);

    const {container} = render(<MetricAlertQuotaMessage />, {
      organization: OrganizationFixture(),
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders approaching limit message with upgrade action', async () => {
    mockUseMetricDetectorLimit.mockReturnValue({
      isLimitExceeded: false,
      limit: 11,
      numMetricMonitors: 10,
    });

    const organization = OrganizationFixture({slug: 'acme'});

    render(<MetricAlertQuotaMessage />, {organization});

    expect(
      await screen.findByText(/approaching the limit of 11 metric monitors/i)
    ).toBeInTheDocument();

    const upgrade = screen.getByRole('button', {name: /upgrade your plan/i});
    await userEvent.click(upgrade);

    expect(openUpsellModal).toHaveBeenCalledWith({
      organization,
      source: 'metric-alert-quota',
    });
  });

  it('renders reached limit message with remove and upgrade actions when at limit', async () => {
    mockUseMetricDetectorLimit.mockReturnValue({
      isLimitExceeded: true,
      limit: 20,
      numMetricMonitors: 20,
    });

    const organization = OrganizationFixture({slug: 'acme'});

    render(<MetricAlertQuotaMessage />, {organization});

    expect(
      screen.getByText(/reached your plan's limit on metric monitors/i)
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
