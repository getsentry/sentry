import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {JsonFormAdapterFieldConfig} from './types';
import {BackendJsonFormAdapter} from './';

function makeConfig(
  overrides?: Partial<Extract<JsonFormAdapterFieldConfig, {type: 'table'}>>
): JsonFormAdapterFieldConfig {
  return {
    name: 'service_table',
    type: 'table',
    label: 'PagerDuty Services',
    columnKeys: ['service', 'integration_key'],
    columnLabels: {service: 'Service', integration_key: 'Integration Key'},
    addButtonText: 'Add Service',
    confirmDeleteMessage: 'Are you sure you want to delete this service?',
    ...overrides,
  };
}

function renderField(fieldConfig: JsonFormAdapterFieldConfig, initialValue?: unknown) {
  const org = OrganizationFixture();
  const mutationOptions = {
    mutationFn: jest.fn().mockResolvedValue({}),
  };

  render(
    <BackendJsonFormAdapter
      field={fieldConfig}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    />,
    {organization: org}
  );

  return {mutationOptions};
}

describe('TableAdapter', () => {
  it('renders empty state with only Add button visible', () => {
    renderField(makeConfig(), []);

    expect(screen.getByRole('button', {name: /Add Service/})).toBeInTheDocument();
    // No column headers or delete buttons when empty
    expect(screen.queryByText('Service')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
  });

  it('renders existing rows with column headers and input fields', () => {
    renderField(makeConfig(), [
      {id: '1', service: 'My Service', integration_key: 'abc123'},
      {id: '2', service: 'Other Service', integration_key: 'def456'},
    ]);

    // Column headers
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Integration Key')).toBeInTheDocument();

    // Input fields with correct values
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(4);
    expect(inputs[0]).toHaveValue('My Service');
    expect(inputs[1]).toHaveValue('abc123');
    expect(inputs[2]).toHaveValue('Other Service');
    expect(inputs[3]).toHaveValue('def456');

    // Delete buttons
    expect(screen.getAllByRole('button', {name: 'Delete'})).toHaveLength(2);
  });

  it('add row triggers mutation', async () => {
    const {mutationOptions} = renderField(makeConfig(), []);

    await userEvent.click(screen.getByRole('button', {name: /Add Service/}));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        service_table: [{id: '', service: '', integration_key: ''}],
      });
    });
  });

  it('edit cell triggers mutation when all fields filled', async () => {
    const {mutationOptions} = renderField(makeConfig(), [
      {id: '1', service: 'My Service', integration_key: 'abc123'},
    ]);

    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]!);
    await userEvent.type(inputs[0]!, 'Updated Service');

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        service_table: [{id: '1', service: 'Updated Service', integration_key: 'abc123'}],
      });
    });
  });

  it('edit cell does NOT save if any non-id field is empty', async () => {
    const {mutationOptions} = renderField(makeConfig(), [
      {id: '1', service: 'My Service', integration_key: 'abc123'},
    ]);

    // Clear the service field — now it's empty, so no save should happen
    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]!);

    // The mutation should not have been called (clearing leaves an empty field)
    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
  });

  it('delete row triggers mutation after confirmation', async () => {
    const {mutationOptions} = renderField(makeConfig(), [
      {id: '1', service: 'My Service', integration_key: 'abc123'},
      {id: '2', service: 'Other Service', integration_key: 'def456'},
    ]);
    renderGlobalModal();

    // Click delete on first row
    const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
    await userEvent.click(deleteButtons[0]!);

    // Confirm dialog should appear
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        service_table: [{id: '2', service: 'Other Service', integration_key: 'def456'}],
      });
    });
  });

  it('delete confirmation shows custom message', async () => {
    renderField(makeConfig(), [
      {id: '1', service: 'My Service', integration_key: 'abc123'},
    ]);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(
      await screen.findByText('Are you sure you want to delete this service?')
    ).toBeInTheDocument();
  });

  it('controls disabled during in-flight mutation', async () => {
    let resolveMutation!: () => void;
    const mutationOptions = {
      mutationFn: jest.fn(
        () => new Promise<void>(resolve => (resolveMutation = resolve))
      ),
    };

    const org = OrganizationFixture();
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[{id: '1', service: 'My Service', integration_key: 'abc123'}]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Add button and delete button should be enabled
    expect(screen.getByRole('button', {name: /Add Service/})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled();

    // Trigger mutation by adding a row
    await userEvent.click(screen.getByRole('button', {name: /Add Service/}));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalled();
    });

    // Controls should be disabled during mutation
    expect(screen.getByRole('button', {name: /Add Service/})).toBeDisabled();
    const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
    for (const btn of deleteButtons) {
      expect(btn).toBeDisabled();
    }

    // Resolve the mutation
    resolveMutation();

    // Controls should be re-enabled
    await waitFor(() => {
      expect(screen.getByRole('button', {name: /Add Service/})).toBeEnabled();
    });
  });
});
