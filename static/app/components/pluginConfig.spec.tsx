import {WebhookPluginConfigFixture} from 'sentry-fixture/integrationListDirectory';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

    expect(await screen.findByText('No errors returned')).toBeInTheDocument();
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

    expect(await screen.findByLabelText('Callback URLs')).toBeInTheDocument();
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

  it('submits typed defaults when backend returns null for non-select fields', async () => {
    const webhookPlugin = WebhookPluginConfigFixture({enabled: true});
    const url = `/projects/${organization.slug}/${project.slug}/plugins/${webhookPlugin.id}/`;

    const configBody = {
      ...webhookPlugin,
      config: [
        {
          name: 'auto_create',
          label: 'Automatically create tickets',
          type: 'bool',
          required: false,
          value: null,
        },
        {
          name: 'repository',
          label: 'Repository',
          type: 'select',
          choices: [
            ['', 'select a repo'],
            ['getsentry/sentry', 'getsentry/sentry'],
          ],
          required: false,
          value: null,
        },
      ],
    };

    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: configBody,
    });
    const saveRequest = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: configBody,
    });
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: configBody,
    });

    render(<PluginConfig plugin={webhookPlugin} project={project} />);

    await userEvent.click(await screen.findByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(saveRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          data: {
            auto_create: false,
            repository: null,
          },
        })
      )
    );
  });
});
