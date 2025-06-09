import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

import GithubInstallationSelectInstallButton from './githubInstallationSelectInstall';

// Mock the functions
jest.mock('getsentry/actionCreators/modal', () => ({
  openUpsellModal: jest.fn(),
}));

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

describe('GithubInstallationSelectInstallButton', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
  });

  const defaultProps = {
    handleSubmit: jest.fn(),
    hasSCMMultiOrg: true,
    installationID: '-1',
    isSaving: false,
    subscription,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders Install button when installationID is -1', async () => {
    MockApiClient.addMockResponse({
      url: '/subscriptions/org-slug/',
      method: 'GET',
      body: subscription,
    });

    render(<GithubInstallationSelectInstallButton {...defaultProps} />);
    expect(await screen.findByText('Install')).toBeInTheDocument();
  });

  it('renders Upgrade button when has_scm_multi_org is false and installationID is not -1', () => {
    render(
      <GithubInstallationSelectInstallButton
        {...defaultProps}
        installationID="123"
        hasSCMMultiOrg={false}
      />
    );
    expect(screen.getByText('Upgrade')).toBeInTheDocument();
  });

  it('renders Install button when has_scm_multi_org is true and installationID is not -1', () => {
    render(
      <GithubInstallationSelectInstallButton
        {...defaultProps}
        installationID="123"
        hasSCMMultiOrg
      />
    );
    expect(screen.getByText('Install')).toBeInTheDocument();
  });

  it('calls handleSubmit when clicked', () => {
    render(<GithubInstallationSelectInstallButton {...defaultProps} />);
    screen.getByRole('button').click();
    expect(defaultProps.handleSubmit).toHaveBeenCalled();
  });

  it('opens upsell modal and tracks analytics when Upgrade button is clicked', async () => {
    MockApiClient.addMockResponse({
      url: '/subscriptions/org-slug/',
      method: 'GET',
      body: subscription,
    });

    render(
      <GithubInstallationSelectInstallButton
        {...defaultProps}
        hasSCMMultiOrg={false}
        installationID="1"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Upgrade'}));

    expect(trackAnalytics).toHaveBeenCalledWith('github.multi_org.upsell', {
      organization,
      subscriptionTier: subscription.planTier,
    });

    expect(openUpsellModal).toHaveBeenCalledWith({
      source: 'github.multi_org',
      organization,
    });
  });
});
