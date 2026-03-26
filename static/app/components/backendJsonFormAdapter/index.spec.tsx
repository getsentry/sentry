// test: verifying changedSince
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {BackendJsonFormAdapter} from './';

const org = OrganizationFixture();
const mutationOptions = {
  mutationFn: jest.fn().mockResolvedValue({}),
};

describe('BackendJsonFormAdapter', () => {
  it('renders boolean field as Switch', () => {
    render(
      <BackendJsonFormAdapter
        field={{
          name: 'sync_enabled',
          type: 'boolean',
          label: 'Enable Sync',
          help: 'Toggle sync on or off',
        }}
        initialValue={false}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    expect(screen.getByText('Enable Sync')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders text field as Input', () => {
    render(
      <BackendJsonFormAdapter
        field={{
          name: 'webhook_url',
          type: 'string',
          label: 'Webhook URL',
          help: 'Enter the webhook URL',
        }}
        initialValue="https://example.com"
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    expect(screen.getByText('Webhook URL')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('https://example.com');
  });

  it('renders select field with options', () => {
    render(
      <BackendJsonFormAdapter
        field={{
          name: 'priority',
          type: 'select',
          label: 'Priority',
          help: 'Select a priority',
          choices: [
            ['high', 'High'],
            ['medium', 'Medium'],
            ['low', 'Low'],
          ],
        }}
        initialValue="medium"
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders table field with add button', () => {
    render(
      <BackendJsonFormAdapter
        field={{
          name: 'table_field',
          type: 'table',
          label: 'Table Field',
          addButtonText: 'Add Item',
        }}
        initialValue={[]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    expect(screen.getByRole('button', {name: /Add Item/})).toBeInTheDocument();
  });

  it('boolean toggle triggers POST', async () => {
    render(
      <BackendJsonFormAdapter
        field={{
          name: 'sync_enabled',
          type: 'boolean',
          label: 'Enable Sync',
          help: 'Toggle sync on or off',
        }}
        initialValue={false}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        sync_enabled: true,
      });
    });
  });

  it('handles disabled fields', () => {
    render(
      <BackendJsonFormAdapter
        field={{
          name: 'sync_enabled',
          type: 'boolean',
          label: 'Enable Sync',
          help: 'Toggle sync on or off',
          disabled: true,
        }}
        initialValue={false}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
