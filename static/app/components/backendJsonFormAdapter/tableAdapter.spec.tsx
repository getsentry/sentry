// test: verifying changedSince
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
): Extract<JsonFormAdapterFieldConfig, {type: 'table'}> {
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

const org = OrganizationFixture();
const mutationOptions = {
  mutationFn: jest.fn().mockResolvedValue({}),
};

describe('TableAdapter', () => {
  it('renders empty state with only Add button visible', () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    expect(screen.getByRole('button', {name: /Add Service/})).toBeInTheDocument();
    // No column headers or delete buttons when empty
    expect(screen.queryByText('Service')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
  });

  it('renders existing rows with column headers and input fields', () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[
          {id: '1', service: 'My Service', integration_key: 'abc123'},
          {id: '2', service: 'Other Service', integration_key: 'def456'},
        ]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

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

  it('add row does NOT immediately save', async () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    await userEvent.click(screen.getByRole('button', {name: /Add Service/}));

    // New empty row should appear but no save yet
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
  });

  it('edit cell does NOT save on every keystroke', async () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[{id: '1', service: 'My Service', integration_key: 'abc123'}]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]!);
    await userEvent.type(inputs[0]!, 'Updated Service');

    // No save yet — haven't blurred
    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
  });

  it('edit cell triggers mutation on blur when all fields filled', async () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[{id: '1', service: 'My Service', integration_key: 'abc123'}]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]!);
    await userEvent.type(inputs[0]!, 'Updated Service');
    await userEvent.click(document.body); // blur

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        service_table: [{id: '1', service: 'Updated Service', integration_key: 'abc123'}],
      });
    });
  });

  it('blur does NOT save if any non-id field is empty', async () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[{id: '1', service: 'My Service', integration_key: 'abc123'}]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]!);
    await userEvent.click(document.body); // blur

    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
  });

  it('delete row triggers mutation after confirmation', async () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[
          {id: '1', service: 'My Service', integration_key: 'abc123'},
          {id: '2', service: 'Other Service', integration_key: 'def456'},
        ]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );
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
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[{id: '1', service: 'My Service', integration_key: 'abc123'}]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(
      await screen.findByText('Are you sure you want to delete this service?')
    ).toBeInTheDocument();
  });

  it('pressing Enter in a cell triggers save when all fields are filled', async () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[{id: '1', service: 'My Service', integration_key: 'abc123'}]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]!);
    await userEvent.type(inputs[0]!, 'Updated Service');

    // No save yet
    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();

    // Press Enter to submit
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        service_table: [{id: '1', service: 'Updated Service', integration_key: 'abc123'}],
      });
    });
  });

  it('pressing Enter in a cell does NOT save when a field is empty', async () => {
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[{id: '1', service: 'My Service', integration_key: 'abc123'}]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    const inputs = screen.getAllByRole('textbox');
    // Clear the field so it's empty
    await userEvent.clear(inputs[0]!);

    // Press Enter — should NOT save because service is empty
    await userEvent.keyboard('{Enter}');

    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
  });

  it('controls disabled during in-flight mutation', async () => {
    let resolveMutation!: () => void;
    const pendingMutationOptions = {
      mutationFn: jest.fn(
        () => new Promise<void>(resolve => (resolveMutation = resolve))
      ),
    };

    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[{id: '1', service: 'My Service', integration_key: 'abc123'}]}
        mutationOptions={pendingMutationOptions}
      />,
      {organization: org}
    );

    // Add button and delete button should be enabled
    expect(screen.getByRole('button', {name: /Add Service/})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled();

    // Trigger mutation by editing a field and blurring
    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]!);
    await userEvent.type(inputs[0]!, 'Updated');
    await userEvent.click(document.body); // blur triggers save

    await waitFor(() => {
      expect(pendingMutationOptions.mutationFn).toHaveBeenCalled();
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
