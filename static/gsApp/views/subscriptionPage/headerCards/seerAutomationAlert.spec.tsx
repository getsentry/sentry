import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useDismissAlert} from 'sentry/utils/useDismissAlert';

import {SeerAutomationAlert} from 'getsentry/views/subscriptionPage/seerAutomationAlert';

jest.mock('sentry/utils/useDismissAlert');

const mockUseDismissAlert = jest.mocked(useDismissAlert);

describe('SeerAutomationAlert', () => {
  const defaultOrganization = OrganizationFixture({
    features: ['seer-added'],
    slug: 'test-org',
  });

  const baseRouterConfig = {
    location: {
      pathname: '/settings/test-org/billing/overview/',
      query: {showSeerAutomationAlert: 'true'},
    },
    route: '/settings/:orgId/billing/overview/',
  };

  beforeEach(() => {
    // Default mocks
    mockUseDismissAlert.mockImplementation(() => ({
      dismiss: jest.fn(),
      isDismissed: false,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders when all conditions are met', () => {
    render(<SeerAutomationAlert organization={defaultOrganization} />, {
      initialRouterConfig: baseRouterConfig,
    });

    expect(
      screen.getByText(
        'Seer issue scans and fixes run automatically at low settings by default'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'You can configure how these work across all of your projects, including the threshold. Changing the threshold will affect how often they run and may impact your bill.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Manage Seer Automation Settings')).toBeInTheDocument();
  });

  it('has correct link to seer automation settings', () => {
    render(<SeerAutomationAlert organization={defaultOrganization} />, {
      initialRouterConfig: baseRouterConfig,
    });

    const link = screen.getByText('Manage Seer Automation Settings');
    expect(link.closest('a')).toHaveAttribute('href', '/settings/test-org/seer/');
  });

  it('calls dismiss when close button is clicked', async () => {
    const dismiss = jest.fn();
    mockUseDismissAlert.mockImplementation(() => ({
      dismiss,
      isDismissed: false,
    }));

    render(<SeerAutomationAlert organization={defaultOrganization} />, {
      initialRouterConfig: baseRouterConfig,
    });

    const dismissButton = screen.getByLabelText('Dismiss banner');
    await userEvent.click(dismissButton);

    expect(dismiss).toHaveBeenCalled();
  });

  it('does not render when dismissed', () => {
    mockUseDismissAlert.mockImplementation(() => ({
      dismiss: jest.fn(),
      isDismissed: true,
    }));

    const {container} = render(
      <SeerAutomationAlert organization={defaultOrganization} />,
      {initialRouterConfig: baseRouterConfig}
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when organization does not have seer-added feature', () => {
    const organizationWithoutSeer = OrganizationFixture({
      features: [], // No seer-added feature
      slug: 'test-org',
    });

    const {container} = render(
      <SeerAutomationAlert organization={organizationWithoutSeer} />,
      {initialRouterConfig: baseRouterConfig}
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when there is no showSeerAutomationAlert query parameter', () => {
    const {container} = render(
      <SeerAutomationAlert organization={defaultOrganization} />,
      {
        initialRouterConfig: {
          ...baseRouterConfig,
          location: {
            ...baseRouterConfig.location,
            query: {},
          },
        },
      }
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders when there is a showSeerAutomationAlert query parameter', () => {
    render(<SeerAutomationAlert organization={defaultOrganization} />, {
      initialRouterConfig: baseRouterConfig,
    });

    expect(
      screen.getByText(
        'Seer issue scans and fixes run automatically at low settings by default'
      )
    ).toBeInTheDocument();
  });

  it('uses correct dismiss key with organization id', () => {
    render(<SeerAutomationAlert organization={defaultOrganization} />, {
      initialRouterConfig: baseRouterConfig,
    });

    expect(mockUseDismissAlert).toHaveBeenCalledWith({
      key: `${defaultOrganization.id}:seer-automation-billing-alert`,
    });
  });
});
