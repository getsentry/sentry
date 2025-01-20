import {InstallWizardFixture} from 'sentry-fixture/installWizard';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import App from 'sentry/views/app';

function HookWrapper(props: any) {
  return (
    <div data-test-id="hook-wrapper">
      {props.children}
      <span>{JSON.stringify(props?.organization ?? {}, null, 2)}</span>
    </div>
  );
}

describe('App', function () {
  const configState = ConfigStore.getState();
  const {routerProps} = initializeOrg();

  beforeEach(function () {
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

  afterEach(function () {
    jest.resetAllMocks();
  });

  it('renders', async function () {
    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(screen.getByText('placeholder content')).toBeInTheDocument();
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('renders NewsletterConsent', async function () {
    const user = ConfigStore.get('user');
    user.flags.newsletter_consent_prompt = true;

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => OrganizationsStore.getAll().length === 1);

    const updatesViaEmail = await screen.findByText(
      'Yes, I would like to receive updates via email',
      undefined,
      {timeout: 2000, interval: 100}
    );
    expect(updatesViaEmail).toBeInTheDocument();

    user.flags.newsletter_consent_prompt = false;
  });

  it('renders BeaconConsent', async function () {
    ConfigStore.set('shouldShowBeaconConsentPrompt', true);
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('isSelfHosted', true);

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => OrganizationsStore.getAll().length === 1);

    const beaconConsentText = await screen.findByText(
      'We have made some updates to our self-hosted beacon broadcast system, and just need to get a quick answer from you.',
      undefined,
      {timeout: 2000, interval: 100}
    );
    expect(beaconConsentText).toBeInTheDocument();
  });

  it('renders PartnershipAgreement', async function () {
    ConfigStore.set('partnershipAgreementPrompt', {
      partnerDisplayName: 'Foo',
      agreements: ['standard', 'partner_presence'],
    });
    HookStore.add('component:partnership-agreement', () => <HookWrapper key={0} />);
    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(HookStore.get('component:partnership-agreement')).toHaveLength(1);
    expect(screen.getByTestId('hook-wrapper')).toBeInTheDocument();
  });

  it('does not render PartnerAgreement for non-partnered orgs', async function () {
    ConfigStore.set('partnershipAgreementPrompt', null);
    HookStore.add('component:partnership-agreement', () => <HookWrapper key={0} />);
    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(screen.getByText('placeholder content')).toBeInTheDocument();
    expect(screen.queryByTestId('hook-wrapper')).not.toBeInTheDocument();
  });

  it('renders InstallWizard for self-hosted', async function () {
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('needsUpgrade', true);
    ConfigStore.set('isSelfHosted', true);

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => OrganizationsStore.getAll().length === 1);

    const completeSetup = await screen.findByText(
      'Complete setup by filling out the required configuration.'
    );
    expect(completeSetup).toBeInTheDocument();
  });

  it('does not render InstallWizard for non-self-hosted', async function () {
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('needsUpgrade', true);
    ConfigStore.set('isSelfHosted', false);

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(screen.getByText('placeholder content')).toBeInTheDocument();
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('redirects to sentryUrl on invalid org slug', async function () {
    const {sentryUrl} = ConfigStore.get('links');
    render(
      <App {...routerProps} params={{orgId: 'albertos%2fapples'}}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => OrganizationsStore.getAll().length === 1);
    expect(screen.queryByText('placeholder content')).not.toBeInTheDocument();
    expect(sentryUrl).toBe('https://sentry.io');
    expect(window.location.replace).toHaveBeenCalledWith('https://sentry.io');
    expect(window.location.replace).toHaveBeenCalledTimes(1);
  });

  it('adds health issues to alertstore', async function () {
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

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );
    act(() => ConfigStore.set('isSelfHosted', restore));

    await waitFor(() => OrganizationsStore.getAll().length === 1);

    expect(getMock).toHaveBeenCalled();
    expect(
      await screen.findByText(/Celery workers have not checked in/)
    ).toBeInTheDocument();
  });
});
