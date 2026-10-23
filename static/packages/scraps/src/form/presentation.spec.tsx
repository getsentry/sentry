import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
// eslint-disable-next-line no-restricted-imports
import {useForm} from '@tanstack/react-form';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  AutoSaveContextProvider,
  useAutoSaveContext,
} from '@sentry/scraps/form/autoSaveContext';
import {DisplayField} from '@sentry/scraps/form/displayField';
import {useFieldId, useHintTextId, useLabelId} from '@sentry/scraps/form/field/fieldIds';
import {
  GroupProvider,
  type GroupContextValue,
} from '@sentry/scraps/form/field/groupContext';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {fieldContext as FieldContext} from '@sentry/scraps/form/formContext';
import {FieldLayout} from '@sentry/scraps/form/layout';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

function Control({group = false}: {group?: boolean}) {
  const id = useFieldId();
  const hintId = useHintTextId();
  const labelId = useLabelId();
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
  const form = useForm({defaultValues: {name: ''}});
  return (
    <form.Field name="name">
      {field => (
        <FieldContext value={field}>
          <GroupWrapper group={group}>
            <FieldLayout.Row
              label="Name"
              hintText="Choose a name"
              required
              variant={compact ? 'compact' : undefined}
            >
              <Control group={group} />
              <FieldMeta.Status error={error} disabled={disabled} />
            </FieldLayout.Row>
          </GroupWrapper>
        </FieldContext>
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
    expect(screen.getByRole('term')).toHaveTextContent('CreatedCreation date');
    expect(screen.getByRole('definition')).toHaveTextContent('January 1, 2025');
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
