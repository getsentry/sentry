import {InstallWizard} from 'sentry-fixture/installWizard';
import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import App from 'sentry/views/app';

describe('App', function () {
  const {routerProps} = initializeOrg();

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [Organization({slug: 'billy-org', name: 'billy org'})],
    });

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });

    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: InstallWizard(),
    });
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it('renders', function () {
    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

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

    const updatesViaEmail = await screen.findByText(
      'Yes, I would like to receive updates via email',
      undefined,
      {timeout: 2000, interval: 100}
    );
    expect(updatesViaEmail).toBeInTheDocument();

    user.flags.newsletter_consent_prompt = false;
  });

  it('renders InstallWizard', async function () {
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('needsUpgrade', true);

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    const completeSetup = await screen.findByText(
      'Complete setup by filling out the required configuration.'
    );
    expect(completeSetup).toBeInTheDocument();
  });

  it('redirects to sentryUrl on invalid org slug', function () {
    const {sentryUrl} = ConfigStore.get('links');
    render(
      <App {...routerProps} params={{orgId: 'albertos%2fapples'}}>
        <div>placeholder content</div>
      </App>
    );

    expect(screen.queryByText('placeholder content')).not.toBeInTheDocument();
    expect(sentryUrl).toEqual('https://sentry.io');
    expect(window.location.replace).toHaveBeenCalledWith('https://sentry.io');
    expect(window.location.replace).toHaveBeenCalledTimes(1);
  });
});
