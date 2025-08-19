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

const mockuseMetricDetectorLimit = useMetricDetectorLimit as unknown as jest.Mock;

describe('MetricAlertQuotaMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when hook returns null', () => {
    mockuseMetricDetectorLimit.mockReturnValue(null);

    const {container} = render(<MetricAlertQuotaMessage />, {
      organization: OrganizationFixture(),
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders approaching detectorLimit message with upgrade action', async () => {
    mockuseMetricDetectorLimit.mockReturnValue({
      hasReachedLimit: false,
      detectorLimit: 11,
      detectorCount: 10,
    });

    const organization = OrganizationFixture({slug: 'acme'});

    render(<MetricAlertQuotaMessage />, {organization});

    expect(await screen.findByText(/used 10 of 11 metric monitors/i)).toBeInTheDocument();

    const upgrade = screen.getByRole('button', {name: /upgrade your plan/i});
    await userEvent.click(upgrade);

    expect(openUpsellModal).toHaveBeenCalledWith({
      organization,
      source: 'metric-alert-quota',
    });
  });

  it('renders reached detectorLimit message with remove and upgrade actions when at detectorLimit', async () => {
    mockuseMetricDetectorLimit.mockReturnValue({
      hasReachedLimit: true,
      detectorLimit: 20,
      detectorCount: 20,
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
