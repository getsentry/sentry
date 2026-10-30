import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
// eslint-disable-next-line no-restricted-imports
import {createFormHook} from '@tanstack/react-form';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  AutoSaveContextProvider,
  useAutoSaveContext,
  DisplayField,
  getFieldId,
  getHintTextId,
  getLabelId,
  fieldComponent,
  type FieldWithValue,
  GroupProvider,
  type GroupContextValue,
  FieldMeta,
  FieldLayout,
} from '@sentry/scraps/formPresentation';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

function Control({
  group = false,
  field,
}: {
  field: FieldWithValue<unknown>;
  group?: boolean;
}) {
  const id = getFieldId(field);
  const hintId = getHintTextId(field);
  const labelId = getLabelId(field);
  return group ? (
    <div role="group" aria-labelledby={labelId} aria-describedby={hintId}>
      <input type="checkbox" aria-label="First choice" />
    </div>
  ) : (
    <input id={id} aria-describedby={hintId} />
  );
}

function GroupWrapper({children, group}: {children: React.ReactNode; group?: boolean}) {
  const value: GroupContextValue = {
    'aria-invalid': false,
    disabled: false,
    isChecked: () => false,
    name: 'name',
    onChange: () => {},
  };
  return group ? <GroupProvider value={value}>{children}</GroupProvider> : children;
}

const {useAppForm} = createFormHook({
  fieldComponents: {
    Control: fieldComponent.loose(Control, 'field'),
    Meta: FieldMeta,
    Layout: FieldLayout,
  },
  formComponents: {},
});

function ExampleField({
  compact,
  group,
  error,
  disabled,
}: {
  compact?: boolean;
  disabled?: boolean | string;
  error?: string;
  group?: boolean;
}) {
  const form = useAppForm({defaultValues: {name: ''}});
  return (
    <form.Field name="name">
      {field => (
        <GroupWrapper group={group}>
          <field.Layout.Row
            label="Name"
            hintText="Choose a name"
            required
            variant={compact ? 'compact' : undefined}
          >
            <field.Control group={group} />
            <field.Meta.Status error={error} disabled={disabled} />
          </field.Layout.Row>
        </GroupWrapper>
      )}
    </form.Field>
  );
}

function AutoSaveStatus() {
  return <output aria-label="Save status">{useAutoSaveContext()?.status}</output>;
}

describe('form presentation', () => {
  it('renders display fields without a form context', () => {
    render(
      <DisplayField.Row label="Created" hintText="Creation date">
        January 1, 2025
      </DisplayField.Row>,
      {wrapper: ThemeWrapper}
    );
    const term = screen.getByRole('term');
    const definition = screen.getByRole('definition');
    expect(term).toHaveTextContent('CreatedCreation date');
    expect(definition).toHaveTextContent('January 1, 2025');
    // eslint-disable-next-line testing-library/no-node-access -- Verify the term and definition share a description list.
    expect(term.closest('dl')).toBe(definition.parentElement);
  });

  it('places stacked display hints after the value', () => {
    render(
      <DisplayField.Stack label="Created" hintText="Creation date">
        January 1, 2025
      </DisplayField.Stack>,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByRole('term')).toHaveTextContent(/^Created$/);
    expect(screen.getByRole('definition')).toHaveTextContent(
      'January 1, 2025Creation date'
    );
  });

  it.each([false, true])('links labels and hints with compact=%s', async compact => {
    render(<ExampleField compact={compact} />, {wrapper: ThemeWrapper});
    const input = screen.getByRole('textbox', {name: 'Name'});
    expect(input).toHaveAccessibleDescription('Choose a name');
    expect(screen.getByText('(required)')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Name'));
    expect(input).toHaveFocus();
  });

  it('labels grouped controls without a native label', () => {
    render(<ExampleField group />, {wrapper: ThemeWrapper});
    expect(screen.getByRole('group', {name: 'Name'})).toHaveAccessibleDescription(
      'Choose a name'
    );
    expect(screen.getByText('Name').tagName).toBe('SPAN');
  });

  it('prioritizes an error over a disabled reason', async () => {
    render(<ExampleField error="Invalid name" disabled="Read only" />, {
      wrapper: ThemeWrapper,
    });
    expect(await screen.findByText('Invalid name')).toBeInTheDocument();
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
  });

  it('shares auto-save state through its provider', () => {
    render(
      <AutoSaveContextProvider
        value={{status: 'pending', resetOnErrorRef: {current: false}}}
      >
        <AutoSaveStatus />
      </AutoSaveContextProvider>,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByRole('status', {name: 'Save status'})).toHaveTextContent(
      'pending'
    );
  });
});
