import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {type JsonFormAdapterFieldConfig} from './types';
import {LegacyJsonFormAdapter} from './';

function renderField(fieldConfig: JsonFormAdapterFieldConfig, initialValue?: unknown) {
  const org = OrganizationFixture();
  const mutationOptions = {
    mutationFn: jest.fn().mockResolvedValue({}),
  };

  render(
    <LegacyJsonFormAdapter
      field={fieldConfig}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    />,
    {organization: org}
  );

  return {mutationOptions};
}

describe('LegacyJsonFormAdapter', () => {
  it('renders boolean field as Switch', () => {
    renderField(
      {
        name: 'sync_enabled',
        type: 'boolean',
        label: 'Enable Sync',
        help: 'Toggle sync on or off',
      },
      false
    );

    expect(screen.getByText('Enable Sync')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders text field as Input', () => {
    renderField(
      {
        name: 'webhook_url',
        type: 'string',
        label: 'Webhook URL',
        help: 'Enter the webhook URL',
      },
      'https://example.com'
    );

    expect(screen.getByText('Webhook URL')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('https://example.com');
  });

  it('renders select field with options', () => {
    renderField(
      {
        name: 'priority',
        type: 'select',
        label: 'Priority',
        help: 'Select a priority',
        choices: [
          ['high', 'High'],
          ['medium', 'Medium'],
          ['low', 'Low'],
        ],
      },
      'medium'
    );

    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders placeholder for choice_mapper', () => {
    renderField(
      {
        name: 'mapper',
        type: 'choice_mapper',
        label: 'Choice Mapper',
      },
      undefined
    );

    expect(screen.getByText(/not supported in auto-save mode/i)).toBeInTheDocument();
  });

  it('renders placeholder for table', () => {
    renderField(
      {
        name: 'table_field',
        type: 'table',
        label: 'Table Field',
      },
      undefined
    );

    expect(screen.getByText(/not supported in auto-save mode/i)).toBeInTheDocument();
  });

  it('boolean toggle triggers POST', async () => {
    const {mutationOptions} = renderField(
      {
        name: 'sync_enabled',
        type: 'boolean',
        label: 'Enable Sync',
        help: 'Toggle sync on or off',
      },
      false
    );

    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        sync_enabled: true,
      });
    });
  });

  it('handles disabled fields', () => {
    renderField(
      {
        name: 'sync_enabled',
        type: 'boolean',
        label: 'Enable Sync',
        help: 'Toggle sync on or off',
        disabled: true,
      },
      false
    );

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
