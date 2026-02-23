import {z} from 'zod';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {AutoSaveField, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

interface TestFormProps {
  label: string;
  defaultValue?: boolean;
  disabled?: boolean | string;
  hintText?: string;
  required?: boolean;
  validator?: z.ZodObject<{enabled: z.ZodBoolean}>;
}

function TestForm({
  label,
  hintText,
  required,
  defaultValue = false,
  disabled,
  validator,
}: TestFormProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      enabled: defaultValue,
    },
    validators: validator ? {onBlur: validator} : undefined,
  });

  return (
    <form.AppForm>
      <form.AppField name="enabled">
        {field => (
          <field.Layout.Row label={label} hintText={hintText} required={required}>
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

const testSchema = z.object({
  enabled: z.boolean(),
});

interface AutoSaveTestFormProps {
  mutationFn: (data: {enabled: boolean}) => Promise<{enabled: boolean}>;
  initialValue?: boolean;
  label?: string;
  onError?: (error: Error) => void;
}

function AutoSaveTestForm({
  mutationFn,
  initialValue = false,
  label = 'Enable Feature',
  onError,
}: AutoSaveTestFormProps) {
  return (
    <AutoSaveField
      name="enabled"
      schema={testSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn, onError}}
    >
      {field => (
        <field.Layout.Row label={label}>
          <field.Switch checked={field.state.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

describe('SwitchField', () => {
  it('renders with a label', () => {
    render(<TestForm label="Enable Feature" />);

    expect(screen.getByText('Enable Feature')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('displays checked state correctly', () => {
    render(<TestForm label="Enable Feature" defaultValue />);

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('displays unchecked state correctly', () => {
    render(<TestForm label="Enable Feature" defaultValue={false} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('toggles on click', async () => {
    render(<TestForm label="Enable Feature" />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });
});

describe('SwitchField disabled', () => {
  it('is disabled when disabled prop is true', () => {
    render(<TestForm label="Enable Feature" disabled />);

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('shows tooltip with reason when disabled is a string', async () => {
    render(<TestForm label="Enable Feature" disabled="Feature not available" />);

    expect(screen.getByRole('checkbox')).toBeDisabled();

    // Hover on the switch to trigger tooltip
    await userEvent.hover(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByText('Feature not available')).toBeInTheDocument();
    });
  });
});

describe('SwitchField auto-save', () => {
  it('shows spinner when auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{enabled: boolean}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue={false} />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    expect(
      await screen.findByRole('status', {name: 'Saving enabled'})
    ).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({enabled: true});
  });

  it('shows checkmark when auto-save succeeds', async () => {
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue={false} />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Wait for mutation to succeed - there are 2 checkmark icons:
    // one inside the Switch toggle and one as the success indicator
    await waitFor(() => {
      const checkmarks = screen.getAllByTestId('icon-check-mark');
      expect(checkmarks.length).toBeGreaterThan(1);
    });
    expect(mutationFn).toHaveBeenCalledWith({enabled: true});
  });

  it('disables switch while auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{enabled: boolean}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue={false} />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(checkbox).toBeDisabled();
    });
  });

  it('does not trigger mutation when toggling back to initial value', async () => {
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue={false} />);

    const checkbox = screen.getByRole('checkbox');
    // Toggle on then off - ends up at initial value
    await userEvent.click(checkbox);
    // First click triggers mutation
    expect(mutationFn).toHaveBeenCalledTimes(1);

    // Clear mock to check next behavior
    mutationFn.mockClear();
    await userEvent.click(checkbox);

    // Second click back to initial value should not trigger mutation
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('does not hang when mutation fails', async () => {
    const mutationFn = jest.fn(() => Promise.reject(new Error('Network error')));
    const onError = jest.fn();

    render(
      <AutoSaveTestForm mutationFn={mutationFn} onError={onError} initialValue={false} />
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Mutation should be called
    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledWith({enabled: true});
    });

    // Error handler should be invoked by TanStack Query
    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });

    // Form should not hang - checkbox should become enabled again after mutation fails
    await waitFor(() => {
      expect(checkbox).toBeEnabled();
    });
  });
});

describe('SwitchField keyboard navigation', () => {
  it('can be toggled with Space key', async () => {
    render(<TestForm label="Enable Feature" />);

    const checkbox = screen.getByRole('checkbox');
    checkbox.focus();
    expect(checkbox).not.toBeChecked();

    await userEvent.keyboard(' ');

    expect(checkbox).toBeChecked();
  });
});

describe('SwitchField a11y', () => {
  it('focuses the switch when clicking on the label', async () => {
    render(<TestForm label="Enable Feature" />);

    await userEvent.click(screen.getByText('Enable Feature'));

    expect(screen.getByRole('checkbox')).toHaveFocus();
  });

  it('includes required text for screen readers when required is true', () => {
    render(<TestForm label="Enable Feature" required />);

    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('renders hint text', () => {
    render(<TestForm label="Enable Feature" hintText="Toggle to enable this feature" />);

    expect(screen.getByText('Toggle to enable this feature')).toBeInTheDocument();
  });

  it('has aria-invalid false by default', () => {
    render(<TestForm label="Enable Feature" />);

    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('SwitchField with confirm', () => {
  it('shows confirmation modal with string confirm', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
        confirm="Are you sure you want to change this?"
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Modal should be shown
    expect(
      await screen.findByText('Are you sure you want to change this?')
    ).toBeInTheDocument();

    // Mutation should not be called yet
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('shows confirmation modal with function confirm', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
        confirm={value => (value ? 'Are you sure you want to enable this?' : undefined)}
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Modal should be shown
    expect(
      await screen.findByText('Are you sure you want to enable this?')
    ).toBeInTheDocument();

    // Mutation should not be called yet
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('does not show modal when function returns undefined', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue
        mutationOptions={{mutationFn}}
        confirm={value => (value ? 'Are you sure you want to enable this?' : undefined)}
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // No modal should be shown (toggling to false returns undefined)
    expect(
      screen.queryByText('Are you sure you want to enable this?')
    ).not.toBeInTheDocument();

    // Mutation should be called immediately
    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledWith({enabled: false});
    });
  });

  it('applies change and triggers save when user confirms', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
        confirm="Are you sure?"
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Modal should be shown
    await screen.findByText('Are you sure?');

    // Click confirm button
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // Mutation should be called after confirmation
    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledWith({enabled: true});
    });
  });

  it('does not hang when mutation fails after confirm', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn(() => Promise.reject(new Error('Network error')));
    const onError = jest.fn();

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn, onError}}
        confirm="Are you sure?"
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Modal should be shown
    await screen.findByText('Are you sure?');

    // Click confirm button - mutation will fail
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // Mutation should be called
    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledWith({enabled: true});
    });

    // Error handler should be invoked by TanStack Query
    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });

    // Form should not hang - checkbox should become enabled again after mutation fails
    await waitFor(() => {
      expect(checkbox).toBeEnabled();
    });
  });

  it('does not apply change when user cancels', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
        confirm="Are you sure?"
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Modal should be shown
    await screen.findByText('Are you sure?');

    // Click cancel button
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    // Wait a bit to ensure mutation is not called
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mutation should not be called
    expect(mutationFn).not.toHaveBeenCalled();

    // Checkbox should still be unchecked
    expect(checkbox).not.toBeChecked();
  });

  it('always focuses cancel button for safety', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
        confirm="This is a dangerous operation!"
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Modal should be shown
    await screen.findByText('This is a dangerous operation!');

    // Cancel button should have autofocus (always dangerous)
    expect(screen.getByRole('button', {name: 'Cancel'})).toHaveFocus();
  });

  it('supports different messages for each direction with function', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    // Test enabling: start with false, toggle to true
    const {unmount} = render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
        confirm={value =>
          value ? 'Are you sure you want to ENABLE?' : 'Are you sure you want to DISABLE?'
        }
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    await userEvent.click(screen.getByRole('checkbox'));

    // Should show enable message
    expect(
      await screen.findByText('Are you sure you want to ENABLE?')
    ).toBeInTheDocument();

    // Cancel and unmount
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    unmount();

    // Test disabling: start with true, toggle to false
    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue
        mutationOptions={{mutationFn}}
        confirm={value =>
          value ? 'Are you sure you want to ENABLE?' : 'Are you sure you want to DISABLE?'
        }
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    await userEvent.click(screen.getByRole('checkbox'));

    // Should show disable message
    expect(
      await screen.findByText('Are you sure you want to DISABLE?')
    ).toBeInTheDocument();
  });
});

describe('SwitchField resetOnError', () => {
  it('resets switch to initial value when mutation fails and resetOnError is true', async () => {
    const mutationFn = jest.fn(() => Promise.reject(new Error('Network error')));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);

    // After mutation failure, switch should revert to unchecked
    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
    });
  });

  it('resets switch after confirmed mutation fails with resetOnError', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn(() => Promise.reject(new Error('Network error')));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
        confirm="Are you sure?"
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Confirm the modal
    await screen.findByText('Are you sure?');
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // After mutation failure, switch should revert to unchecked
    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
    });
  });
});

describe('SwitchField failed to save error', () => {
  it('shows "Failed to save" error when mutation fails', async () => {
    const mutationFn = jest.fn(() => Promise.reject(new Error('Network error')));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    await userEvent.click(screen.getByRole('checkbox'));

    // "Failed to save" error should appear
    expect(await screen.findByText('Failed to save')).toBeInTheDocument();

    // Field should be marked as invalid
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows "Failed to save" error after confirmed mutation fails', async () => {
    renderGlobalModal();
    const mutationFn = jest.fn(() => Promise.reject(new Error('Network error')));

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
        confirm="Are you sure?"
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    await userEvent.click(screen.getByRole('checkbox'));

    // Confirm the modal
    await screen.findByText('Are you sure?');
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // "Failed to save" error should appear
    expect(await screen.findByText('Failed to save')).toBeInTheDocument();
  });

  it('clears "Failed to save" error on next successful save', async () => {
    let shouldFail = true;
    const mutationFn = jest.fn((data: {enabled: boolean}) => {
      if (shouldFail) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve(data);
    });

    render(
      <AutoSaveField
        name="enabled"
        schema={testSchema}
        initialValue={false}
        mutationOptions={{mutationFn}}
      >
        {field => (
          <field.Layout.Row label="Enable Feature">
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );

    const checkbox = screen.getByRole('checkbox');

    // First click fails
    await userEvent.click(checkbox);
    expect(await screen.findByText('Failed to save')).toBeInTheDocument();

    // Next click should succeed
    shouldFail = false;
    await userEvent.click(checkbox);

    // Error should be cleared after successful save
    await waitFor(() => {
      expect(screen.queryByText('Failed to save')).not.toBeInTheDocument();
    });
  });
});
