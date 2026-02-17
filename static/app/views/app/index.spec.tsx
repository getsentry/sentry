import {InstallWizardFixture} from 'sentry-fixture/installWizard';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import AlertStore from 'sentry/stores/alertStore';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import App from 'sentry/views/app';

function HookWrapper(props: any) {
  return (
    <div data-test-id="hook-wrapper">
      {props.children}
      <span>{JSON.stringify(props?.organization ?? {}, null, 2)}</span>
    </div>
  );
}

function PlaceholderContent() {
  return <div>placeholder content</div>;
}

const defaultRouterConfig = {
  location: {pathname: '/organizations/org-slug/'},
  children: [
    {
      index: true,
      element: <PlaceholderContent />,
    },
  ],
  route: '/organizations/:orgSlug/',
};

describe('App', () => {
  const configState = ConfigStore.getState();

  beforeEach(() => {
    const organization = OrganizationFixture();

    ConfigStore.init();
    ConfigStore.loadInitialData(configState);

    HookStore.init();

    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [organization],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: organization,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: InstallWizardFixture(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders', async () => {
    render(<App />, {initialRouterConfig: defaultRouterConfig});

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(screen.getByText('placeholder content')).toBeInTheDocument();
    expect(testableWindowLocation.replace).not.toHaveBeenCalled();
  });

  it('renders NewsletterConsent', async () => {
    const user = ConfigStore.get('user');
    user.flags.newsletter_consent_prompt = true;

    render(<App />, {initialRouterConfig: defaultRouterConfig});

    await waitFor(() => OrganizationsStore.getAll().length === 1);

    const updatesViaEmail = await screen.findByText(
      'Yes, I would like to receive updates via email',
      undefined,
      {timeout: 2000, interval: 100}
    );
    expect(updatesViaEmail).toBeInTheDocument();

    user.flags.newsletter_consent_prompt = false;
  });

  it('renders BeaconConsent', async () => {
    ConfigStore.set('shouldShowBeaconConsentPrompt', true);
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('isSelfHosted', true);

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });

    render(<App />, {initialRouterConfig: defaultRouterConfig});

    await waitFor(() => OrganizationsStore.getAll().length === 1);

    const beaconConsentText = await screen.findByText(
      'We have made some updates to our self-hosted beacon broadcast system, and just need to get a quick answer from you.',
      undefined,
      {timeout: 2000, interval: 100}
    );
    expect(beaconConsentText).toBeInTheDocument();
  });

  it('renders PartnershipAgreement', async () => {
    ConfigStore.set('partnershipAgreementPrompt', {
      partnerDisplayName: 'Foo',
      agreements: ['standard', 'partner_presence'],
    });
    HookStore.add('component:partnership-agreement', () => <HookWrapper key={0} />);
    render(<App />, {initialRouterConfig: defaultRouterConfig});

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(HookStore.get('component:partnership-agreement')).toHaveLength(1);
    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();
  });

  it('does not render PartnerAgreement for non-partnered orgs', async () => {
    ConfigStore.set('partnershipAgreementPrompt', null);
    HookStore.add('component:partnership-agreement', () => <HookWrapper key={0} />);
    render(<App />, {initialRouterConfig: defaultRouterConfig});

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(screen.getByText('placeholder content')).toBeInTheDocument();
    expect(screen.queryByTestId('hook-wrapper')).not.toBeInTheDocument();
  });

  it('renders InstallWizard for self-hosted', async () => {
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('needsUpgrade', true);
    ConfigStore.set('isSelfHosted', true);

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });

    render(<App />, {initialRouterConfig: defaultRouterConfig});

    await waitFor(() => OrganizationsStore.getAll().length === 1);

    const completeSetup = await screen.findByText(
      'Complete setup by filling out the required configuration.'
    );
    expect(completeSetup).toBeInTheDocument();
  });

  it('does not render InstallWizard for non-self-hosted', async () => {
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('needsUpgrade', true);
    ConfigStore.set('isSelfHosted', false);

    render(<App />, {initialRouterConfig: defaultRouterConfig});

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(screen.getByText('placeholder content')).toBeInTheDocument();
    expect(testableWindowLocation.replace).not.toHaveBeenCalled();
  });

  it('redirects to sentryUrl on invalid org slug', async () => {
    const {sentryUrl} = ConfigStore.get('links');
    // Avoid mounting OrganizationContextProvider and related preloads which
    // would issue org-specific requests for the invalid slug
    ConfigStore.set('shouldPreloadData', false);
    render(<App />, {
      initialRouterConfig: {
        location: {pathname: '/organizations/albertos%2fapples/'},
        route: '/organizations/:orgId/',
        children: [
          {
            index: true,
            element: <PlaceholderContent />,
          },
        ],
      },
    });

    await waitFor(() => expect(testableWindowLocation.replace).toHaveBeenCalled());
    expect(screen.queryByText('placeholder content')).not.toBeInTheDocument();
    expect(sentryUrl).toBe('https://sentry.io');
    expect(testableWindowLocation.replace).toHaveBeenCalledWith('https://sentry.io');
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(1);
  });

  it('adds health issues to alertstore', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        healthy: false,
        problems: [
          {
            id: 'abc123',
            message: 'Celery workers have not checked in',
            severity: 'critical',
          },
        ],
      },
    });
    const restore = ConfigStore.get('isSelfHosted');
    ConfigStore.set('isSelfHosted', true);

    render(<App />, {initialRouterConfig: defaultRouterConfig});
    act(() => ConfigStore.set('isSelfHosted', restore));

    await waitFor(() => OrganizationsStore.getAll().length === 1);

    expect(getMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(AlertStore.getState()).toEqual([
        expect.objectContaining({
          id: 'abc123',
          message: 'Celery workers have not checked in',
          opaque: true,
          variant: 'danger',
        }),
      ]);
    });
  });
});
