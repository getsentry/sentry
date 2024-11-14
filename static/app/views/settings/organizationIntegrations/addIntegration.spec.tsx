import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import AddIntegration from 'sentry/views/settings/organizationIntegrations/addIntegration';

describe('AddIntegration', function () {
  const provider = GitHubIntegrationProviderFixture();
  const integration = GitHubIntegrationFixture();
  let configState: Config;

  function interceptMessageEvent(event: MessageEvent) {
    if (event.origin === '') {
      event.stopImmediatePropagation();
      const eventWithOrigin = new MessageEvent('message', {
        data: event.data,
        origin: 'https://foobar.sentry.io',
      });
      window.dispatchEvent(eventWithOrigin);
    }
  }

  beforeEach(function () {
    configState = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: {
        subdomain: 'foobar',
        organizationUrl: 'https://foobar.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
      links: {
        organizationUrl: 'https://foobar.sentry.io',
        regionUrl: 'https://us.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });

    window.location.assign('https://foobar.sentry.io');
    window.addEventListener('message', interceptMessageEvent);
  });

  afterEach(function () {
    window.removeEventListener('message', interceptMessageEvent);
    ConfigStore.loadInitialData(configState);
  });

  it('Adds an integration on dialog completion', async function () {
    const onAdd = jest.fn();

    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus});
    global.open = open;

    render(
      <AddIntegration
        organization={OrganizationFixture()}
        provider={provider}
        onInstall={onAdd}
      >
        {openDialog => (
          <a href="#" onClick={() => openDialog()}>
            Click
          </a>
        )}
      </AddIntegration>
    );

    const newIntegration = {
      success: true,
      data: Object.assign({}, integration, {
        id: '2',
        domain_name: 'new-integration.github.com',
        icon: 'http://example.com/new-integration-icon.png',
        name: 'New Integration',
      }),
    };

    window.postMessage(newIntegration, '*');
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(newIntegration.data));
  });
});
