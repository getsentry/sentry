import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import App from 'sentry/views/app';

describe('App', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization({slug: 'billy-org', name: 'billy org'})],
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
      body: TestStubs.InstallWizard(),
    });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        replace: jest.fn(),
      },
    });
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it('renders', function () {
    render(
      <App params={{orgId: 'org-slug'}}>
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
      <App params={{orgId: 'org-slug'}}>
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
    ConfigStore.set('version', {current: '1.33.7'});

    render(
      <App params={{orgId: 'org-slug'}}>
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
      <App params={{orgId: 'albertos%2fapples'}}>
        <div>placeholder content</div>
      </App>
    );

    expect(screen.queryByText('placeholder content')).not.toBeInTheDocument();
    expect(sentryUrl).toEqual('https://sentry.io');
    expect(window.location.replace).toHaveBeenCalledWith('https://sentry.io');
    expect(window.location.replace).toHaveBeenCalledTimes(1);
  });
});
