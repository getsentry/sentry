import {WebhookPluginConfigFixture} from 'sentry-fixture/integrationListDirectory';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import plugins from 'sentry/plugins';

import PluginConfig from './pluginConfig';

describe('PluginConfig', () => {
  const {organization, project} = initializeOrg();

  it('can test webhook plugin', async () => {
    const webhookPlugin = WebhookPluginConfigFixture({enabled: true});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${webhookPlugin.id}/`,
      method: 'GET',
      body: webhookPlugin,
    });
    const testWebhookMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${webhookPlugin.id}/`,
      method: 'POST',
      body: {detail: 'No errors returned'},
    });

    expect(plugins.isLoaded(webhookPlugin)).toBe(false);
    render(<PluginConfig plugin={webhookPlugin} project={project} />);
    expect(plugins.isLoaded(webhookPlugin)).toBe(true);

    await userEvent.click(screen.getByRole('button', {name: 'Test Plugin'}));

    expect(await screen.findByText('"No errors returned"')).toBeInTheDocument();
    expect(testWebhookMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        data: {test: true},
      })
    );
  });
});
