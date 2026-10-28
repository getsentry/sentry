import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {ServerlessFunction} from 'sentry/types/integrations';
import {IntegrationServerlessFunctions} from 'sentry/views/settings/organizationIntegrations/integrationServerlessFunctions';

describe('IntegrationServerlessFunctions', () => {
  const organization = OrganizationFixture();
  const baseIntegration = OrganizationIntegrationsFixture();
  const integration = OrganizationIntegrationsFixture({
    id: '42',
    provider: {
      ...baseIntegration.provider,
      key: 'aws_lambda',
      slug: 'aws_lambda',
      name: 'AWS Lambda',
      features: ['serverless'],
    },
  });
  const endpoint = `/organizations/${organization.slug}/integrations/${integration.id}/serverless-functions/`;

  const enabledFunction: ServerlessFunction = {
    name: 'enabled-function',
    runtime: 'nodejs22.x',
    version: 3,
    enabled: true,
    outOfDate: false,
  };
  const outdatedFunction: ServerlessFunction = {
    name: 'outdated-function',
    runtime: 'python3.12',
    version: 1,
    enabled: true,
    outOfDate: true,
  };
  const disabledFunction: ServerlessFunction = {
    name: 'disabled-function',
    runtime: 'python3.13',
    version: -1,
    enabled: false,
    outOfDate: false,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders each serverless function in column order when the functions load', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [enabledFunction, outdatedFunction, disabledFunction],
    });

    render(<IntegrationServerlessFunctions integration={integration} />, {
      organization,
    });

    const table = screen.getByRole('table', {name: 'Serverless Functions'});
    const enabledRow = await within(table).findByRole('row', {
      name: /enabled-function/,
    });

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Name', 'Layer Status', 'Enabled']);
    expect(
      within(enabledRow)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual(['enabled-functionnodejs22.x\u00A0|\u00A0v3', 'Latest', '']);
    expect(
      within(within(table).getByRole('row', {name: /outdated-function/})).getByRole(
        'button',
        {name: 'Update'}
      )
    ).toBeInTheDocument();
    expect(
      within(within(table).getByRole('row', {name: /disabled-function/})).getAllByRole(
        'cell'
      )[1]
    ).toHaveTextContent('Disabled');
    expect(screen.getByRole('checkbox', {name: 'Enable enabled-function'})).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Enable disabled-function'})
    ).not.toBeChecked();
  });

  it('enables a function when its switch is toggled on', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [disabledFunction],
    });
    const toggleRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {...disabledFunction, enabled: true, version: 4},
    });

    render(<IntegrationServerlessFunctions integration={integration} />, {
      organization,
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Enable disabled-function'})
    );

    expect(toggleRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        data: {action: 'enable', target: 'disabled-function'},
      })
    );
    expect(await screen.findByText('python3.13 | v4')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: 'Enable disabled-function'})
    ).toBeChecked();
  });

  it('updates the layer when the Update button is clicked for an outdated function', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [outdatedFunction],
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {...outdatedFunction, outOfDate: false, version: 2},
    });

    render(<IntegrationServerlessFunctions integration={integration} />, {
      organization,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Update'}));

    expect(updateRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        data: {action: 'updateVersion', target: 'outdated-function'},
      })
    );
    expect(await screen.findByText('python3.12 | v2')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Update'})).not.toBeInTheDocument();
  });

  it('restores the switch when the toggle request fails', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [enabledFunction],
    });
    const toggleRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Toggle failed'},
    });

    render(<IntegrationServerlessFunctions integration={integration} />, {
      organization,
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Enable enabled-function'})
    );

    expect(toggleRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        data: {action: 'disable', target: 'enabled-function'},
      })
    );
    expect(
      await screen.findByRole('checkbox', {name: 'Enable enabled-function'})
    ).toBeEnabled();
    expect(screen.getByRole('checkbox', {name: 'Enable enabled-function'})).toBeChecked();
    expect(screen.getByText('nodejs22.x | v3')).toBeInTheDocument();
  });

  it('renders an empty message when there are no serverless functions', async () => {
    MockApiClient.addMockResponse({url: endpoint, body: []});

    render(<IntegrationServerlessFunctions integration={integration} />, {
      organization,
    });

    expect(
      await within(screen.getByRole('table', {name: 'Serverless Functions'})).findByText(
        'No serverless functions found'
      )
    ).toBeInTheDocument();
  });

  it('renders an error with a retry when the serverless functions request fails', async () => {
    MockApiClient.addMockResponse({url: endpoint, statusCode: 500});

    render(<IntegrationServerlessFunctions integration={integration} />, {
      organization,
    });

    const table = screen.getByRole('table', {name: 'Serverless Functions'});

    expect(
      await within(table).findByText('Error loading serverless functions')
    ).toBeInTheDocument();
    expect(within(table).getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });
});
