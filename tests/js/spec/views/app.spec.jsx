import {mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'app/stores/configStore';
import App from 'app/views/app';

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
      url: '/assistant/?v2',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: TestStubs.InstallWizard(),
    });
  });

  it('renders', async function () {
    const {getByText} = mountWithTheme(
      <App params={{orgId: 'org-slug'}}>
        <div>placeholder content</div>
      </App>
    );

    expect(getByText('placeholder content')).toBeInTheDocument();
  });

  it('renders NewsletterConsent', async function () {
    const user = ConfigStore.get('user');
    user.flags.newsletter_consent_prompt = true;

    const {getByText} = mountWithTheme(
      <App params={{orgId: 'org-slug'}}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => {
      const node = getByText('Yes, I would like to receive updates via email');
      return expect(node).toBeInTheDocument();
    });

    user.flags.newsletter_consent_prompt = false;
  });

  it('renders InstallWizard', async function () {
    ConfigStore.get('user').isSuperuser = true;
    ConfigStore.set('needsUpgrade', true);
    ConfigStore.set('version', {current: '1.33.7'});

    const {getByText} = mountWithTheme(
      <App params={{orgId: 'org-slug'}}>
        <div>placeholder content</div>
      </App>
    );

    await waitFor(() => {
      const node = getByText('Complete setup by filling out the required configuration.');
      return expect(node).toBeInTheDocument();
    });
  });
});
