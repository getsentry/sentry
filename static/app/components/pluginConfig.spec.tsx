import {WebhookPluginConfigFixture} from 'sentry-fixture/integrationListDirectory';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PluginConfig} from './pluginConfig';

describe('PluginConfig', () => {
  const {organization, project} = initializeOrg();

  it('can test webhook plugin', async () => {
    const webhookPlugin = WebhookPluginConfigFixture({enabled: true});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${webhookPlugin.id}/`,
      method: 'GET',
      body: {
        ...webhookPlugin,
        config: [
          {
            name: 'urls',
            label: 'Callback URLs',
            type: 'textarea',
            placeholder: 'https://sentry.io/callback/url',
            required: false,
            help: 'Enter callback URLs, separated by newlines.',
            value: 'https://example.com/hook',
            defaultValue: '',
          },
        ],
      },
    });
    const testWebhookMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${webhookPlugin.id}/`,
      method: 'POST',
      body: {detail: 'No errors returned'},
    });

    render(<PluginConfig plugin={webhookPlugin} project={project} />);

    await userEvent.click(await screen.findByRole('button', {name: 'Test Plugin'}));

    expect(await screen.findByText('"No errors returned"')).toBeInTheDocument();
    expect(testWebhookMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        data: {test: true},
      })
    );
  });

  it('renders config fields from backend', async () => {
    const webhookPlugin = WebhookPluginConfigFixture({enabled: true});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${webhookPlugin.id}/`,
      method: 'GET',
      body: {
        ...webhookPlugin,
        config: [
          {
            name: 'urls',
            label: 'Callback URLs',
            type: 'textarea',
            placeholder: 'https://sentry.io/callback/url',
            required: false,
            help: 'Enter callback URLs, separated by newlines.',
            value: '',
            defaultValue: '',
          },
        ],
      },
    });

    render(<PluginConfig plugin={webhookPlugin} project={project} />);

    expect(await screen.findByText('Callback URLs')).toBeInTheDocument();
  });

  it('renders auth error state', async () => {
    const webhookPlugin = WebhookPluginConfigFixture({enabled: true});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${webhookPlugin.id}/`,
      method: 'GET',
      body: {
        ...webhookPlugin,
        config_error: 'You need to associate an identity',
        auth_url: '/auth/associate/webhooks/',
      },
    });

    render(<PluginConfig plugin={webhookPlugin} project={project} />);

    expect(
      await screen.findByText('You need to associate an identity')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Associate Identity'})).toBeInTheDocument();
  });
});
