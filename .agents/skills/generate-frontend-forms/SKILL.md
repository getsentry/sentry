---
name: generate-frontend-forms
description: Guide for creating forms using Sentry's new form system. Use when implementing forms, form fields, validation, or auto-save functionality.
---

# Form System Guide

This skill provides patterns for building forms using Sentry's new form system, built on TanStack React Form v2 and Zod validation.

## Core Principle

- Always use the new form system (`useScrapsForm`, `AutoSaveForm`) for new forms. Never create new forms with the legacy JsonForm or Reflux-based systems.

- All forms should be schema based. DO NOT create a form without schema validation.

## Imports

All form components are exported from `@sentry/scraps/form`:

```tsx
import {z} from 'zod';

import {
  AutoSaveForm,
  defaultFormValidators,
  ScrapsForm,
  toFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
```

> **Important**: DO NOT import from deeper paths, like '@sentry/scraps/form/field'. You can only use what is part of the PUBLIC interface in the index file in @sentry/scraps/form. Never import from `@tanstack/react-form` directly — an ESLint rule blocks it. If you need a type that the barrel does not export, add the export to `static/app/components/core/form/index.ts` rather than reaching past it.

---

## Form Hook: `useScrapsForm`

The main hook for creating forms with validation and submission handling.

### Basic Usage

```tsx
import {z} from 'zod';

import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';

const schema = z.object({
  email: z.email('Invalid email'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

function MyForm() {
  const form = useScrapsForm({
    defaultValues: {
      email: '',
      name: '',
    },
    validators: defaultFormValidators(schema),
    onSubmit: ({value}) => {
      // Handle submission
      console.log(value);
    },
  });

  return (
    <ScrapsForm form={form}>
      <form.Field name="email">
        {field => (
          <field.Layout.Stack label={t('Email')} required>
            <field.Input value={field.value} onChange={field.handleChange} />
          </field.Layout.Stack>
        )}
      </form.Field>

      <form.SubmitButton>{t('Submit')}</form.SubmitButton>
    </ScrapsForm>
  );
}
```

> **Important**: `<ScrapsForm form={form}>` is the outer wrapper. It renders the `<form>` element and provides form context, so `form.SubmitButton` and the other form components work. There is no `...defaultFormOptions` spread — error visibility and invalid-submit focus are configured once inside `createFormHook`.

### Validation Timing

The form system applies one policy to every form:

- **Error visibility** — validation errors are hidden until the first submit attempt, then shown as the user edits. This is set globally via `errorVisibility` and needs no per-form configuration.
- **`defaultFormValidators(schema)`** — additionally delays _running_ the validator until after the first submit attempt, then re-runs it on change and blur. Use it for form-level schema validation.

Both together reproduce "validate on submit, then on every change". Every validator also runs on submit regardless of its triggers, so `defaultFormValidators` never skips submit-time validation.

Reach for a raw validator entry when you need different timing:

```tsx
const form = useScrapsForm({
  defaultValues,
  validators: [{run: schema, triggers: ['change']}],
  onSubmit,
});
```

### Returned Properties

| Property         | Description                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `Field`          | Field renderer. Takes `name` and a render function receiving the field API with all bound field components. |
| `ArrayField`     | Array field renderer. Use for lists that render child fields (`pushValue`, `removeValue`, …).               |
| `FieldGroup`     | Section grouping with title                                                                                 |
| `SubmitButton`   | Pre-wired submit button                                                                                     |
| `ResetButton`    | Pre-wired reset button, disabled while the form is pristine                                                 |
| `Subscribe`      | Subscribe to form state changes                                                                             |
| `atom`           | Form state atom. Read it with `useSelector(form.atom, selector)` outside JSX.                               |
| `reset()`        | Reset form to default values                                                                                |
| `handleSubmit()` | Manually trigger submission                                                                                 |

---

## Field Components

All fields are accessed via the `field` render prop and follow consistent patterns: pass `value` and `onChange` from the field API, and wrap in a layout.

### Input Field (Text)

```tsx
<form.Field name="firstName">
  {field => (
    <field.Layout.Stack label={t('First Name')} required>
      <field.Input
        value={field.value}
        onChange={field.handleChange}
        placeholder={t('Enter your name')}
      />
    </field.Layout.Stack>
  )}
</form.Field>
```

### Number Field

```tsx
<form.Field name="age">
  {field => (
    <field.Layout.Stack label={t('Age')} required>
      <field.Number
        value={field.value}
        onChange={field.handleChange}
        min={0}
        max={120}
        step={1}
      />
    </field.Layout.Stack>
  )}
</form.Field>
```

### Password Field

Same API as `field.Input`, plus a built-in show/hide toggle.

```tsx
<form.Field name="password">
  {field => (
    <field.Layout.Stack label={t('Password')} required>
      <field.Password value={field.value} onChange={field.handleChange} />
    </field.Layout.Stack>
  )}
</form.Field>
```

### Select Field (Single)

```tsx
<form.Field name="country">
  {field => (
    <field.Layout.Stack label={t('Country')}>
      <field.Select
        value={field.value}
        onChange={field.handleChange}
        options={[
          {value: 'us', label: 'United States'},
          {value: 'uk', label: 'United Kingdom'},
        ]}
      />
    </field.Layout.Stack>
  )}
</form.Field>
```

### Select Field (Multiple)

```tsx
<form.Field name="tags">
  {field => (
    <field.Layout.Stack label={t('Tags')}>
      <field.Select
        multiple
        value={field.value}
        onChange={field.handleChange}
        options={[
          {value: 'bug', label: 'Bug'},
          {value: 'feature', label: 'Feature'},
        ]}
        clearable
      />
    </field.Layout.Stack>
  )}
</form.Field>
```

### Async Select Field

Loads options from an API as the user types. `queryOptions` receives the current input value and returns TanStack Query options.

```tsx
<form.Field name="assignee">
  {field => (
    <field.Layout.Row label={t('Assignee')}>
      <field.SelectAsync
        value={field.value}
        onChange={field.handleChange}
        queryOptions={inputValue => ({
          queryKey: ['users', inputValue],
          queryFn: () => fetchUsers({search: inputValue}),
        })}
      />
    </field.Layout.Row>
  )}
</form.Field>
```

### Switch Field (Boolean)

```tsx
<form.Field name="notifications">
  {field => (
    <field.Layout.Stack label={t('Enable notifications')}>
      <field.Switch checked={field.value} onChange={field.handleChange} />
    </field.Layout.Stack>
  )}
</form.Field>
```

### TextArea Field

```tsx
<form.Field name="bio">
  {field => (
    <field.Layout.Stack label={t('Bio')}>
      <field.TextArea
        value={field.value}
        onChange={field.handleChange}
        rows={4}
        placeholder={t('Tell us about yourself')}
      />
    </field.Layout.Stack>
  )}
</form.Field>
```

### Range Field (Slider)

```tsx
<form.Field name="volume">
  {field => (
    <field.Layout.Stack label={t('Volume')}>
      <field.Range
        value={field.value}
        onChange={field.handleChange}
        min={0}
        max={100}
        step={10}
      />
    </field.Layout.Stack>
  )}
</form.Field>
```

### Radio Field

Radio fields use a composable API with `Radio.Group` and `Radio.Item`. `Radio.Group` provides group context that changes how the label is rendered for proper accessibility semantics.

> **Important**: The layout (and its label) **must** be rendered _inside_ `Radio.Group`. The group context is provided by `Radio.Group`, so placing the layout outside will result in incorrect accessibility semantics.

```tsx
<form.Field name="priority">
  {field => (
    <field.Radio.Group value={field.value} onChange={field.handleChange}>
      <field.Layout.Stack label={t('Priority')}>
        <field.Radio.Item value="low">{t('Low')}</field.Radio.Item>
        <field.Radio.Item value="medium">{t('Medium')}</field.Radio.Item>
        <field.Radio.Item value="high" description={t('Urgent issues')}>
          {t('High')}
        </field.Radio.Item>
      </field.Layout.Stack>
    </field.Radio.Group>
  )}
</form.Field>
```

For horizontal arrangement of radio items, use a `Flex` or `Stack` wrapper inside the layout:

```tsx
import {Flex} from '@sentry/scraps/layout';

<field.Radio.Group value={field.value} onChange={field.handleChange}>
  <field.Layout.Row label={t('Priority')}>
    <Flex gap="lg">
      <field.Radio.Item value="low">{t('Low')}</field.Radio.Item>
      <field.Radio.Item value="high">{t('High')}</field.Radio.Item>
    </Flex>
  </field.Layout.Row>
</field.Radio.Group>;
```

### Custom Fields with BaseField

For one-off fields that don't have a built-in component (e.g. a color picker, or any custom input), use `field.Base`. It provides a render prop with all the necessary accessibility and form integration props (`ref`, `disabled`, `aria-invalid`, `aria-describedby`, `onBlur`, `name`, `id`) that you spread onto your native element.

```tsx
<form.Field name="color">
  {field => (
    <field.Layout.Row label={t('Brand Color')}>
      <field.Base<HTMLInputElement>>
        {(baseProps, {indicator}) => (
          <Flex flexGrow={1}>
            <input
              {...baseProps}
              type="color"
              value={field.value}
              onChange={e => field.handleChange(e.target.value)}
            />
            {indicator}
          </Flex>
        )}
      </field.Base>
    </field.Layout.Row>
  )}
</form.Field>
```

The render prop receives two arguments:

1. **`baseProps`** — accessibility and form integration props (`ref`, `disabled`, `aria-invalid`, `aria-describedby`, `onBlur`, `name`, `id`) to spread onto your element
2. **`{indicator}`** — the auto-save status indicator (spinner/checkmark) as a React node, which you can place wherever makes sense in your custom layout

The element type is inferred from the passed `ref`, so if you don't pass one, you have to manually annotate it with `<field.Base<HTMLInputElement>>`.

`field.Base` automatically handles:

- Merging refs (for scroll-to-hash and external ref forwarding)
- Disabling the field when auto-save is pending
- Setting `aria-invalid` based on validation state
- Linking to hint text via `aria-describedby`

Use `field.Base` instead of building custom wrappers that duplicate this logic. It works with any native HTML element or third-party component that accepts standard props.

---

## Layouts

Two layout options are available for positioning labels and fields.

### Stack Layout (Vertical)

Label above, field below. Best for forms with longer labels or mobile layouts.

```tsx
<field.Layout.Stack
  label={t('Email Address')}
  hintText={t("We'll never share your email")}
  required
>
  <field.Input value={field.value} onChange={field.handleChange} />
</field.Layout.Stack>
```

### Row Layout (Horizontal)

Label on left (~50%), field on right. Compact layout for settings pages.

```tsx
<field.Layout.Row
  label={t('Email Address')}
  hintText={t("We'll never share your email")}
  required
>
  <field.Input value={field.value} onChange={field.handleChange} />
</field.Layout.Row>
```

### Compact Variant

Both Stack and Row layouts support a `variant="compact"` prop. In compact mode, the hint text appears as a tooltip on the label instead of being displayed below. This saves vertical space while still providing the hint information.

```tsx
// Default: hint text appears below the label
<field.Layout.Row label={t('Email')} hintText={t("We'll never share your email")}>
  <field.Input ... />
</field.Layout.Row>

// Compact: hint text appears in tooltip when hovering the label
<field.Layout.Row label={t('Email')} hintText={t("We'll never share your email")} variant="compact">
  <field.Input ... />
</field.Layout.Row>

// Also works with Stack layout
<field.Layout.Stack label={t('Email')} hintText={t("We'll never share your email")} variant="compact">
  <field.Input ... />
</field.Layout.Stack>
```

**When to Use Compact**:

- Settings pages with many fields where vertical space is limited
- Forms where hint text is supplementary, not essential
- Dashboards or panels with constrained height

### Custom Layouts

You are allowed to create new layouts if necessary, or not use any layouts at all. Without a layout, you _should_ render `field.Meta.Label` and optionally `field.Meta.HintText` for a11y.

```tsx
<form.Field name="firstName">
  {field => (
    <Flex gap="md">
      <field.Meta.Label required>{t('First Name:')}</field.Meta.Label>
      <field.Input value={field.value ?? ''} onChange={field.handleChange} />
    </Flex>
  )}
</form.Field>
```

### Layout Props

| Prop       | Type        | Description                                                   |
| ---------- | ----------- | ------------------------------------------------------------- |
| `label`    | `string`    | Field label text                                              |
| `hintText` | `string`    | Helper text (below label by default, tooltip in compact mode) |
| `required` | `boolean`   | Shows required indicator                                      |
| `variant`  | `"compact"` | Shows hint text in tooltip instead of below label             |

---

## Field Groups

Group related fields into titled sections with `form.FieldGroup`. It renders a `Panel` with a header.

```tsx
<form.FieldGroup title={t('Personal Information')}>
  <form.Field name="firstName">{/* ... */}</form.Field>
  <form.Field name="lastName">{/* ... */}</form.Field>
</form.FieldGroup>

<form.FieldGroup title={t('Contact Information')}>
  <form.Field name="email">{/* ... */}</form.Field>
  <form.Field name="phone">{/* ... */}</form.Field>
</form.FieldGroup>
```

### Reusable Field Groups Across Forms

When the same section must bind into several different forms, define a field group with `defineAppFieldGroup`. Declare the virtual field names and their value types, write the component against `fields`, then bind it. Callers map each virtual name to a real path in their own form.

```tsx
import {defineAppFieldGroup, FieldGroup} from '@sentry/scraps/form';

const segmentConfigFieldGroup = defineAppFieldGroup(({strict}) => ({
  write_key: strict<string>(),
}));

function SegmentConfigFieldsImpl({
  fields,
  disabled,
}: {
  disabled: boolean;
  fields: typeof segmentConfigFieldGroup.fields;
}) {
  return (
    <FieldGroup title={t('Global Configuration')}>
      <fields.Field name="write_key">
        {field => (
          <field.Layout.Row label={t('Write Key')} required>
            <field.Input
              value={field.value}
              onChange={field.handleChange}
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </fields.Field>
    </FieldGroup>
  );
}

const SegmentConfigFields = segmentConfigFieldGroup.bindComponent(
  SegmentConfigFieldsImpl,
  'fields'
);

// Caller — `fields` maps virtual names to real paths in this form
<SegmentConfigFields form={form} disabled={disabled} fields={{write_key: 'write_key'}} />;
```

> **Note**: A field group exposes field components only, so use the plain `FieldGroup` import for the panel — there is no `fields.FieldGroup`.

---

## Array Fields

Use `form.ArrayField` for lists that render child fields. It re-renders when the list structure changes, without re-rendering every item on each value change. A whole array value that is _not_ broken into child fields can stay a normal `form.Field`.

```tsx
<form.ArrayField name="branchOverrides">
  {arrayField => (
    <Stack gap="lg">
      {arrayField.value.map((_, index) => (
        <form.Field key={index} name={`branchOverrides[${index}].branch`}>
          {field => (
            <field.Layout.Row label={t('Branch')}>
              <field.Input value={field.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.Field>
      ))}
      <Button onClick={() => arrayField.pushValue({branch: ''})}>{t('Add')}</Button>
    </Stack>
  )}
</form.ArrayField>
```

Array helpers on the render arg: `pushValue`, `insertValue`, `removeValue`, `moveValue`, `swapValues`, `filterValues`, `clearValues`. The same operations exist on the form as path methods (`form.pushFieldValue('branchOverrides', …)`) when you are outside the render prop.

---

## Disabled State

Fields accept `disabled` as a boolean or string. When a string is provided, it displays as a tooltip explaining why the field is disabled.

```tsx
// ❌ Don't disable without explanation
<field.Input disabled value={field.value} onChange={field.handleChange} />

// ✅ Provide a reason when disabling
<field.Input
  disabled="This feature requires a Business plan"
  value={field.value}
  onChange={field.handleChange}
/>
```

---

## Validation with Zod

### Schema Definition

```tsx
import {z} from 'zod';

const userSchema = z.object({
  email: z.email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.number().gte(13, 'You must be at least 13 years old'),
  bio: z.string().optional(),
  tags: z.array(z.string()).optional(),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
  }),
});
```

### Nullable Fields with Refine

When a field starts as `null` (e.g., a required select with no initial selection), use `.nullable().refine()` in the schema. This creates a difference between the schema's _input_ type (which accepts `null`) and its _output_ type (which does not). To handle this correctly:

1. Type `defaultValues` explicitly as `z.input<typeof schema>` — this allows `null` as an initial value.
2. Call `schema.parse(value)` inside `onSubmit` to narrow from `z.input` to `z.output`, stripping the `null` before passing to your mutation.

```tsx
const schema = z.object({
  provider: z
    .enum(['GitHub', 'LaunchDarkly'])
    .nullable()
    .refine(v => v !== null, 'Provider is required'),
  name: z.string().min(1, 'Name is required'),
});

// z.input allows null for the provider field
const defaultValues: z.input<typeof schema> = {
  provider: null,
  name: '',
};

const form = useScrapsForm({
  defaultValues,
  validators: defaultFormValidators(schema),
  onSubmit: ({value}) => {
    // schema.parse narrows null away — mutation receives z.output
    return mutation.mutateAsync(schema.parse(value)).catch(() => {});
  },
});
```

> **Important**: Do NOT use non-null assertions (`value.provider!`) or type casts to work around nullable fields. The `schema.parse()` approach is both type-safe and validates at runtime.

### Conditional Validation

Use `.refine()` for cross-field validation:

```tsx
const schema = z
  .object({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
```

### Per-Field Validators

For validation that only applies to one field, pass a `validators` array to `form.Field`. Each entry is `{run, triggers}`; `run` is a Zod schema or a function, and every entry also runs on submit.

```tsx
<form.Field
  name="secret"
  validators={[
    {
      run: ({value, formApi}) =>
        formApi.state.values.type === 'pattern' && !value.trim()
          ? t('Secret is required')
          : undefined,
      triggers: ['change'],
    },
  ]}
>
  {field => (
    <field.Layout.Row label={t('Secret')} required>
      <field.Input value={field.value ?? ''} onChange={field.handleChange} />
    </field.Layout.Row>
  )}
</form.Field>
```

### Conditional Fields

Use `form.Subscribe` to show/hide fields based on other field values:

```tsx
<form.Subscribe selector={state => state.values.plan === 'enterprise'}>
  {showBilling =>
    showBilling ? (
      <form.Field name="billingEmail">
        {field => (
          <field.Layout.Stack label={t('Billing Email')} required>
            <field.Input value={field.value} onChange={field.handleChange} />
          </field.Layout.Stack>
        )}
      </form.Field>
    ) : null
  }
</form.Subscribe>
```

Outside JSX — when you need a form value in plain component code — use `useSelector` with the form atom:

```tsx
import {useSelector} from '@sentry/scraps/form';

const plan = useSelector(form.atom, state => state.values.plan);
```

> **Important**: `form.state` is a non-reactive snapshot. Reading it during render will not re-render on change. Use `form.Subscribe` or `useSelector(form.atom, …)`.

---

## Listeners

Listeners react to field events without validating. They are an array of `{run, triggers}` entries, optionally debounced with `triggerDebounceMs`.

```tsx
const form = useScrapsForm({
  defaultValues,
  listeners: [
    {
      run: ({formApi}) => void formApi.handleSubmit(),
      triggers: ['change'],
      triggerDebounceMs: 1000,
    },
  ],
  onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
});
```

Field-level listeners use the same shape on `form.Field`:

```tsx
<form.Field
  name="url"
  listeners={[{run: ({value}) => normalize(value), triggers: ['blur']}]}
>
```

Form listener triggers are `change`, `blur`, `submit`, `mount`, `reset`; fields add `unmount`. The form listener context exposes `triggerFieldApi`, which is **optional** — it is absent for mount, reset, and submit, so guard it before reading `triggerFieldApi.meta`.

---

## Error Handling

### Server-Side Errors

Validation errors are **returned** from `onSubmit`, not set imperatively. Use `toFieldErrors` to turn a `RequestError` (or a hand-written error map) into a validation error and return it.

```tsx
import {useMutation} from '@tanstack/react-query';

import {ScrapsForm, toFieldErrors, useScrapsForm} from '@sentry/scraps/form';

import {fetchMutation} from 'sentry/utils/queryClient';

function MyForm() {
  const mutation = useMutation({
    mutationFn: (data: {email: string; username: string}) =>
      fetchMutation({url: '/users/', method: 'POST', data}),
  });

  const form = useScrapsForm({
    defaultValues: {email: '', username: ''},
    validators: defaultFormValidators(schema),
    onSubmit: async ({value, createValidationError}) => {
      try {
        await mutation.mutateAsync(value);
      } catch (error) {
        const fieldErrors = toFieldErrors({value, createValidationError}, error);
        if (fieldErrors) {
          return fieldErrors;
        }
        throw error;
      }
    },
  });

  // ...
}
```

`toFieldErrors` reads `RequestError.responseJSON`, keeps only keys that exist on the form, and returns `undefined` when nothing matched — so the `if (fieldErrors)` check tells you whether the backend gave you anything field-specific.

For manually constructed errors, return `createValidationError` directly:

```tsx
onSubmit: async ({value, createValidationError}) => {
  try {
    await mutation.mutateAsync(value);
  } catch (error) {
    return createValidationError({
      fields: {
        email: {message: t('This email is already registered')},
        'address.city': {message: t('City not found')},
      },
    });
  }
},
```

> **Important**: Field paths support dot notation: `'address.city': {message: 'City not found'}`.

> **Important**: Validation failures are **returned** from `onSubmit`. Thrown or rejected errors are submit failures. Keep transient network failures in the query layer; only return validation errors for things the user can fix in the form.

### Error Display

Validation errors automatically show as a warning icon with tooltip in the field's trailing area. No additional code needed. Read them yourself with `field.errors` (an array of `{message}`) or `field.meta.errors`; both respect the "hidden until first submit" policy.

---

## Auto-Save Pattern

For settings pages where each field saves independently, use `AutoSaveForm`.

### Basic Auto-Save Form

```tsx
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';

import {fetchMutation} from 'sentry/utils/queryClient';

const schema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
});

function SettingsForm() {
  return (
    <AutoSaveForm
      name="displayName"
      schema={schema}
      initialValue={user.displayName}
      mutationOptions={{
        mutationFn: data => {
          return fetchMutation({
            url: '/user/',
            method: 'PUT',
            data,
          });
        },
        onSuccess: data => {
          // Update React Query cache
          queryClient.setQueryData(['user'], old => ({...old, ...data}));
        },
      }}
    >
      {field => (
        <field.Layout.Row label={t('Display Name')}>
          <field.Input value={field.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}
```

`AutoSaveForm` opts out of the global "hide errors until submit" policy — validation errors appear as the user edits, which is the right behaviour when there is no submit button.

### Auto-Save Behavior by Field Type

| Field Type        | When it saves                                               |
| ----------------- | ----------------------------------------------------------- |
| Input, TextArea   | On blur (when user leaves field)                            |
| Select (single)   | Immediately when selection changes                          |
| Select (multiple) | When menu closes, or when X/clear clicked while menu closed |
| Switch            | Immediately when toggled                                    |
| Radio             | Immediately when selection changes                          |
| Range             | When user releases the slider, or immediately with keyboard |

### Auto-Save Status Indicators

The form system automatically shows:

- **Spinner** while saving (pending)
- **Checkmark** on success (fades after 2s)
- **Warning icon** on validation error (with tooltip)

> **Important**: Do NOT use toasts to communicate auto-save status. The built-in inline indicators (spinner, checkmark, warning icon) are the correct feedback mechanism. Toasts are noisy and disruptive for fields that save frequently on every change.

### Sharing Auto-Save Status

Fields rendered outside an `AutoSaveForm` — for example rows of an array field that save through one mutation — can still show the indicators by providing the context themselves:

```tsx
import {AutoSaveContextProvider} from '@sentry/scraps/form';

<AutoSaveContextProvider value={{status: mutation.status, resetOnErrorRef}}>
  {/* fields here render the spinner / checkmark and disable while pending */}
</AutoSaveContextProvider>;
```

`resetOnErrorRef` is a ref that immediate-commit controls (switch, radio) set to `true` so the value snaps back when the save fails.

### Confirmation Dialogs

For dangerous operations (security settings, permissions), use the `confirm` prop to show a confirmation modal before saving. The `confirm` prop accepts either a string or a function.

```tsx
<AutoSaveForm
  name="require2FA"
  schema={schema}
  initialValue={false}
  confirm={value =>
    value
      ? t('This will remove all members without 2FA. Continue?')
      : t('Are you sure you want to allow members without 2FA?')
  }
  mutationOptions={{...}}
>
  {field => (
    <field.Layout.Row label={t('Require Two-Factor Auth')}>
      <field.Switch checked={field.value} onChange={field.handleChange} />
    </field.Layout.Row>
  )}
</AutoSaveForm>
```

**Confirm Config Options:**

| Type                             | Description                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `string`                         | Always show this message before saving                                                      |
| `(value) => string \| undefined` | Function that returns a message based on the new value, or `undefined` to skip confirmation |

> **Note**: Confirmation dialogs always focus the Cancel button for safety, preventing accidental confirmation of dangerous operations.

**Examples:**

```tsx
// ✅ Simple string - always confirm
confirm={t('Are you sure you want to change this setting?')}

// ✅ Only confirm when ENABLING (return undefined to skip)
confirm={value => value ? t('Are you sure you want to enable this?') : undefined}

// ✅ Only confirm when DISABLING
confirm={value => !value ? t('Disabling this removes security protection.') : undefined}

// ✅ For select fields - confirm specific values
confirm={value => value === 'delete' ? t('This will permanently delete all data!') : undefined}
```

---

## Form Submission

> **Important**: Always use TanStack Query mutations (`useMutation`) for form submissions. This ensures proper loading states, error handling, and cache management.

### Using Mutations

```tsx
import {useMutation} from '@tanstack/react-query';

import {fetchMutation} from 'sentry/utils/queryClient';

function MyForm() {
  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      return fetchMutation({
        url: '/endpoint/',
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      // Handle success (e.g., show toast, redirect)
    },
  });

  const form = useScrapsForm({
    defaultValues: {...},
    validators: defaultFormValidators(schema),
    onSubmit: ({value}) => {
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  // ...
}
```

### Resetting After Save

When a form stays on the page after submission (e.g., settings pages), call `form.reset()` after a successful mutation. This re-syncs the form with updated `defaultValues` so it becomes pristine again — any UI that depends on the form being dirty (like conditionally shown Save/Cancel buttons) will update correctly.

```tsx
onSubmit: ({value}) =>
  mutation
    .mutateAsync(value)
    .then(() => form.reset())
    .catch(() => {}),
```

> **Note**: `AutoSaveForm` handles this automatically. You only need to add this when using `useScrapsForm`.

### Submit Button

```tsx
<Flex gap="md" justify="end">
  <form.ResetButton>{t('Reset')}</form.ResetButton>
  <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
</Flex>
```

The `SubmitButton` automatically:

- Disables while submission is pending
- Triggers form validation before submit

---

## Settings Search

If the form lives on a settings page, wrap it in `FormSearch` so its fields appear in the Cmd+K settings search.

```tsx
import {FormSearch} from '@sentry/scraps/form';

<FormSearch route="/settings/account/details/">
  <FieldGroup title={t('Account Details')}>{/* form or AutoSaveForm */}</FieldGroup>
</FormSearch>;
```

`FormSearch` is a **build-time marker** with no runtime behaviour. Rules:

- The `route` must match the settings page URL exactly, including the trailing slash.
- Wrap the entire form section with a single `FormSearch`, not individual fields.
- `label` and `hintText` must be plain string literals or `t()` calls — computed strings are skipped by the extractor.
- After adding or changing fields inside a `FormSearch`, run `pnpm run extract-form-fields` and commit the regenerated `static/app/components/core/form/generatedFieldRegistry.ts`. CI fails if it is out of sync.

---

## Do's and Don'ts

### Form System Choice

```tsx
// ❌ Don't use legacy JsonForm for new forms
<JsonForm fields={[{name: 'email', type: 'text'}]} />;

// ✅ Use useScrapsForm with Zod validation
const form = useScrapsForm({
  defaultValues: {email: ''},
  validators: defaultFormValidators(schema),
});
```

### Validators Are an Array

```tsx
// ❌ v1 shape — event-keyed object, no longer supported
validators: {
  onDynamic: schema;
}

// ❌ Don't add 'submit' to triggers — every validator runs on submit already
validators: [{run: schema, triggers: ['change', 'submit']}];

// ✅ Use the shared policy for form-level schema validation
validators: defaultFormValidators(schema);

// ✅ Or spell out the triggers when you need different timing
validators: [{run: schema, triggers: ['change']}];
```

### Reading Form and Field State

```tsx
// ❌ v1 shape — field.state no longer exists
<field.Input value={field.state.value} />

// ❌ Non-reactive: won't re-render when the value changes
const plan = form.state.values.plan;

// ✅ Read the value straight off the field API
<field.Input value={field.value} onChange={field.handleChange} />

// ✅ Subscribe for reactive reads
<form.Subscribe selector={state => state.values.plan}>{plan => …}</form.Subscribe>
const plan = useSelector(form.atom, state => state.values.plan);
```

### Nullable Default Values

```tsx
// ❌ Don't use non-null assertions or type casts
onSubmit: ({value}) => {
  return mutation.mutateAsync({...value, provider: value.provider!});
};

// ✅ Use z.input for defaultValues and schema.parse in onSubmit
const defaultValues: z.input<typeof schema> = {provider: null, name: ''};

const form = useScrapsForm({
  defaultValues,
  validators: defaultFormValidators(schema),
  onSubmit: ({value}) => {
    return mutation.mutateAsync(schema.parse(value)).catch(() => {});
  },
});
```

### Form Submissions

```tsx
// ❌ Don't call API directly in onSubmit
onSubmit: async ({value}) => {
  await api.post('/users', value);
};

// ❌ Don't use mutateAsync without .catch() - causes unhandled rejection
onSubmit: ({value}) => {
  return mutation.mutateAsync(value);
};

// ✅ Use mutations with fetchMutation and .catch(() => {})
const mutation = useMutation({
  mutationFn: data => fetchMutation({url: '/users/', method: 'POST', data}),
});

onSubmit: ({value}) => {
  // Return the promise to keep form.isSubmitting working
  // Add .catch(() => {}) to avoid unhandled rejection - error handling
  // is done by TanStack Query (onError callback, mutation.isError state)
  // Add .then(() => form.reset()) if the form stays on the page after save
  return mutation
    .mutateAsync(value)
    .then(() => form.reset())
    .catch(() => {});
};
```

### Field Value Handling

```tsx
// ❌ Don't pass a possibly-undefined value to a controlled input
<field.Input value={field.value} />

// ✅ Provide fallback for optional fields
<field.Input value={field.value ?? ''} />
```

### Validation Messages

```tsx
// ❌ Don't use generic error messages
z.string().min(1);

// ✅ Provide helpful, specific error messages
z.string().min(1, 'Email address is required');
```

### Auto-Save Feedback

```tsx
// ❌ Don't use toasts for auto-save status
mutationOptions={{
  mutationFn: (data) => fetchMutation({url: '/user/', method: 'PUT', data}),
  onSuccess: () => {
    addSuccessMessage('Saved!'); // ❌ noisy and disruptive
  },
}}

// ✅ Rely on built-in inline indicators (spinner, checkmark, warning icon)
mutationOptions={{
  mutationFn: (data) => fetchMutation({url: '/user/', method: 'PUT', data}),
  onSuccess: (data) => {
    queryClient.setQueryData(['user'], old => ({...old, ...data}));
    // No toast needed - AutoSaveForm shows a checkmark automatically
  },
}}
```

### Auto-Save Cache Updates

Always update the data store or cache in `onSuccess`. Without this, toggling a field back to its original value won't trigger a save — TanStack Form compares against `defaultValues` (derived from `initialValue`) and skips submission when the value matches.

```tsx
// ❌ Don't forget to update the cache after auto-save
mutationOptions={{
  mutationFn: (data) => fetchMutation({url: '/user/', method: 'PUT', data}),
}}

// ✅ Update React Query cache on success
mutationOptions={{
  mutationFn: (data) => fetchMutation({url: '/user/', method: 'PUT', data}),
  onSuccess: (data) => {
    queryClient.setQueryData(['user'], old => ({...old, ...data}));
  },
}}
```

### Auto-Save Mutation Typing

Type the `mutationFn` with the API's data type, **not** the zod schema type. The schema is for client-side field validation — the mutation should accept whatever the API endpoint accepts. Don't use generic types like `Record<string, unknown>` either, as that breaks TanStack Form's ability to narrow field types.

**NEVER pass call-site generics to `mutationOptions`, `useMutation`, or any TanStack Query function.** Types must be inferred, not asserted. See the full rules in `static/AGENTS.md` under "TanStack Query Type Inference."

```tsx
// ❌ NEVER pass generics to mutationOptions/useMutation
mutationOptions<unknown, RequestError, Variables, Context>({...})
useMutation<Response, RequestError, Variables>({...})

// ❌ Don't use generic types - breaks field type narrowing
const opts = mutationOptions({
  mutationFn: (data: Record<string, unknown>) => fetchMutation({...}),
});

// ❌ Don't tie mutation type to the zod schema
const opts = mutationOptions({
  mutationFn: (data: Partial<z.infer<typeof preferencesSchema>>) => fetchMutation({...}),
});

// ❌ Don't explicitly type context — it's inferred from onMutate return
type MyContext = {previousData: UserDetails};

// ❌ Don't use RequestError as the error generic — use runtime narrowing instead

// ✅ Use the API's data type on mutationFn, let everything else be inferred
const opts = mutationOptions({
  mutationFn: (data: Partial<UserDetails>) =>
    fetchMutation<UserDetails>({...}),
});
```

Make sure the zod schema's types are compatible with the API type. For example, if the API expects a string union like `'off' | 'low' | 'high'`, use `z.enum(['off', 'low', 'high'])` instead of `z.string()`.

### Form Reset After Save

```tsx
// ❌ Don't forget to reset forms that stay on the page after save
onSubmit: ({value}) => {
  return mutation.mutateAsync(value).catch(() => {});
};

// ✅ Call form.reset() after successful save to sync with updated defaultValues
onSubmit: ({value}) => {
  return mutation
    .mutateAsync(value)
    .then(() => form.reset())
    .catch(() => {});
};
```

### Layout Choice

```tsx
// ❌ Don't use Row layout when labels are very long
<field.Layout.Row label={t('Please enter the primary email address for your account')}>

// ✅ Use Stack layout for long labels
<field.Layout.Stack label={t('Please enter the primary email address for your account')}>
```

---

## Quick Reference Checklist

When creating a new form:

- [ ] Import from `@sentry/scraps/form` and `zod` — never from `@tanstack/react-form`
- [ ] Define Zod schema with helpful error messages
- [ ] Set `defaultValues` matching schema shape (use `z.input<typeof schema>` if schema has `.refine()`)
- [ ] Set `validators: defaultFormValidators(schema)`
- [ ] Wrap with `<ScrapsForm form={form}>`
- [ ] Use `<form.Field>` for each field, `<form.ArrayField>` for lists of child fields
- [ ] Read values with `field.value`, not `field.state.value`
- [ ] Choose appropriate layout (Stack or Row)
- [ ] Return `toFieldErrors({value, createValidationError}, error)` from `onSubmit` for server errors
- [ ] Add `<form.SubmitButton>` for submission
- [ ] Call `form.reset()` after successful mutation if the form stays on the page
- [ ] Wrap settings forms in `<FormSearch route="...">` and run `pnpm run extract-form-fields`

When creating auto-save fields:

- [ ] Use `<AutoSaveForm>` component
- [ ] Pass `schema` for validation
- [ ] Pass `initialValue` from current data
- [ ] Configure `mutationOptions` with `mutationFn`
- [ ] Update cache in `onSuccess` callback

---

## File References

| File                                               | Purpose                                     |
| -------------------------------------------------- | ------------------------------------------- |
| `static/app/components/core/form/scrapsForm.tsx`   | Form hook, form components, `toFieldErrors` |
| `static/app/components/core/form/autoSaveForm.tsx` | Auto-save wrapper                           |
| `static/app/components/core/form/field/*.tsx`      | Individual field components                 |
| `static/app/components/core/form/layout/index.tsx` | Layout components                           |
| `static/app/components/core/form/form.mdx`         | Usage examples (submit forms)               |
| `static/app/components/core/form/fields.mdx`       | Usage examples (per field component)        |
| `static/app/components/core/form/autoSaveForm.mdx` | Usage examples (auto-save)                  |
