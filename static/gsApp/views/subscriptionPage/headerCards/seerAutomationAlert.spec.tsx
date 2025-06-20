import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';

import SeerAutomationAlert from 'getsentry/views/subscriptionPage/seerAutomationAlert';

jest.mock('sentry/utils/useDismissAlert');
jest.mock('sentry/utils/useLocation');

const mockUseDismissAlert = jest.mocked(useDismissAlert);
const mockUseLocation = jest.mocked(useLocation);

describe('SeerAutomationAlert', function () {
  const defaultOrganization = OrganizationFixture({
    features: ['seer-added'],
    slug: 'test-org',
  });

  beforeEach(() => {
    // Default mocks
    mockUseDismissAlert.mockImplementation(() => ({
      dismiss: jest.fn(),
      isDismissed: false,
    }));

    mockUseLocation.mockImplementation(() => ({
      query: {referrer: 'billing'},
      pathname: '/settings/test-org/billing/overview/',
      search: '?referrer=billing',
      hash: '',
      state: null,
      key: 'test',
      action: 'PUSH',
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders when all conditions are met', function () {
    render(<SeerAutomationAlert organization={defaultOrganization} />);

    expect(
      screen.getByText(
        'Seer issue scans and fixes are running automatically at low settings'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'You can configure how these work across all of your projects, including the threshold. Changing the threshold will affect how often they run and may impact your bill.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Manage Seer Automation Settings')).toBeInTheDocument();
  });

  it('has correct link to seer automation settings', function () {
    render(<SeerAutomationAlert organization={defaultOrganization} />);

    const link = screen.getByText('Manage Seer Automation Settings');
    expect(link.closest('a')).toHaveAttribute('href', '/settings/test-org/seer/');
  });

  it('calls dismiss when close button is clicked', async function () {
    const dismiss = jest.fn();
    mockUseDismissAlert.mockImplementation(() => ({
      dismiss,
      isDismissed: false,
    }));

    render(<SeerAutomationAlert organization={defaultOrganization} />);

    const dismissButton = screen.getByLabelText('Dismiss banner');
    await userEvent.click(dismissButton);

    expect(dismiss).toHaveBeenCalled();
  });

  it('does not render when dismissed', function () {
    mockUseDismissAlert.mockImplementation(() => ({
      dismiss: jest.fn(),
      isDismissed: true,
    }));

    const {container} = render(
      <SeerAutomationAlert organization={defaultOrganization} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when organization does not have seer-added feature', function () {
    const organizationWithoutSeer = OrganizationFixture({
      features: [], // No seer-added feature
      slug: 'test-org',
    });

    const {container} = render(
      <SeerAutomationAlert organization={organizationWithoutSeer} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when there is no referrer query parameter', function () {
    mockUseLocation.mockImplementation(() => ({
      query: {}, // No referrer
      pathname: '/settings/test-org/billing/overview/',
      search: '',
      hash: '',
      state: null,
      key: 'test',
      action: 'PUSH',
    }));

    const {container} = render(
      <SeerAutomationAlert organization={defaultOrganization} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders when there is any referrer query parameter', function () {
    mockUseLocation.mockImplementation(() => ({
      query: {referrer: 'checkout'},
      pathname: '/settings/test-org/billing/overview/',
      search: '?referrer=checkout',
      hash: '',
      state: null,
      key: 'test',
      action: 'PUSH',
    }));

    render(<SeerAutomationAlert organization={defaultOrganization} />);

    expect(
      screen.getByText(
        'Seer issue scans and fixes are running automatically at low settings'
      )
    ).toBeInTheDocument();
  });

  it('uses correct dismiss key with organization id', function () {
    render(<SeerAutomationAlert organization={defaultOrganization} />);

    expect(mockUseDismissAlert).toHaveBeenCalledWith({
      key: `${defaultOrganization.id}:seer-automation-billing-alert`,
    });
  });
});
