---
name: generate-frontend-forms
description: Guide for creating forms using Sentry's new form system. Use when implementing forms, form fields, validation, or auto-save functionality.
---

# Form System Guide

This skill provides patterns for building forms using Sentry's new form system built on TanStack React Form and Zod validation.

## Core Principle

- Always use the new form system (`useScrapsForm`, `AutoSaveField`) for new forms. Never create new forms with the legacy JsonForm or Reflux-based systems.

- All forms should be schema based. DO NOT create a form without schema validation.

## Imports

All form components are exported from `@sentry/scraps/form`:

```tsx
import {z} from 'zod';

import {
  AutoSaveField,
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
```

> **Important**: DO NOT import from deeper paths, like '@sentry/scraps/form/field'. You can only use what is part of the PUBLIC interface in the index file in @sentry/scraps/form.

---

## Form Hook: `useScrapsForm`

The main hook for creating forms with validation and submission handling.

### Basic Usage

```tsx
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

const schema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

function MyForm() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      email: '',
      name: '',
    },
    validators: {
      onDynamic: schema,
    },
    onSubmit: ({value, formApi}) => {
      // Handle submission
      console.log(value);
    },
  });

  return (
    <form.AppForm>
      <form.FormWrapper>
        <form.AppField name="email">
          {field => (
            <field.Layout.Stack label="Email" required>
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.SubmitButton>Submit</form.SubmitButton>
      </form.FormWrapper>
    </form.AppForm>
  );
}
```

> **Important**: Always spread `defaultFormOptions` first. It configures validation to run on submit initially, then on every change after the first submission. This is why validators are defined as `onDynamic`, and it's what provides a consistent UX.

### Returned Properties

| Property         | Description                                    |
| ---------------- | ---------------------------------------------- |
| `AppForm`        | Root wrapper component (provides form context) |
| `FormWrapper`    | Form element wrapper (handles submit)          |
| `AppField`       | Field renderer component                       |
| `FieldGroup`     | Section grouping with title                    |
| `SubmitButton`   | Pre-wired submit button                        |
| `Subscribe`      | Subscribe to form state changes                |
| `reset()`        | Reset form to default values                   |
| `handleSubmit()` | Manually trigger submission                    |

---

## Field Components

All fields are accessed via the `field` render prop and follow consistent patterns.

### Input Field (Text)

```tsx
<form.AppField name="firstName">
  {field => (
    <field.Layout.Stack label="First Name" required>
      <field.Input
        value={field.state.value}
        onChange={field.handleChange}
        placeholder="Enter your name"
      />
    </field.Layout.Stack>
  )}
</form.AppField>
```

### Number Field

```tsx
<form.AppField name="age">
  {field => (
    <field.Layout.Stack label="Age" required>
      <field.Number
        value={field.state.value}
        onChange={field.handleChange}
        min={0}
        max={120}
        step={1}
      />
    </field.Layout.Stack>
  )}
</form.AppField>
```

### Select Field (Single)

```tsx
<form.AppField name="country">
  {field => (
    <field.Layout.Stack label="Country">
      <field.Select
        value={field.state.value}
        onChange={field.handleChange}
        options={[
          {value: 'us', label: 'United States'},
          {value: 'uk', label: 'United Kingdom'},
        ]}
      />
    </field.Layout.Stack>
  )}
</form.AppField>
```

### Select Field (Multiple)

```tsx
<form.AppField name="tags">
  {field => (
    <field.Layout.Stack label="Tags">
      <field.Select
        multiple
        value={field.state.value}
        onChange={field.handleChange}
        options={[
          {value: 'bug', label: 'Bug'},
          {value: 'feature', label: 'Feature'},
        ]}
        clearable
      />
    </field.Layout.Stack>
  )}
</form.AppField>
```

### Switch Field (Boolean)

```tsx
<form.AppField name="notifications">
  {field => (
    <field.Layout.Stack label="Enable notifications">
      <field.Switch checked={field.state.value} onChange={field.handleChange} />
    </field.Layout.Stack>
  )}
</form.AppField>
```

### TextArea Field

```tsx
<form.AppField name="bio">
  {field => (
    <field.Layout.Stack label="Bio">
      <field.TextArea
        value={field.state.value}
        onChange={field.handleChange}
        rows={4}
        placeholder="Tell us about yourself"
      />
    </field.Layout.Stack>
  )}
</form.AppField>
```

### Range Field (Slider)

```tsx
<form.AppField name="volume">
  {field => (
    <field.Layout.Stack label="Volume">
      <field.Range
        value={field.state.value}
        onChange={field.handleChange}
        min={0}
        max={100}
        step={10}
      />
    </field.Layout.Stack>
  )}
</form.AppField>
```

---

## Layouts

Two layout options are available for positioning labels and fields.

### Stack Layout (Vertical)

Label above, field below. Best for forms with longer labels or mobile layouts.

```tsx
<field.Layout.Stack
  label="Email Address"
  hintText="We'll never share your email"
  required
>
  <field.Input value={field.state.value} onChange={field.handleChange} />
</field.Layout.Stack>
```

### Row Layout (Horizontal)

Label on left (~50%), field on right. Compact layout for settings pages.

```tsx
<field.Layout.Row label="Email Address" hintText="We'll never share your email" required>
  <field.Input value={field.state.value} onChange={field.handleChange} />
</field.Layout.Row>
```

### Compact Variant

Both Stack and Row layouts support a `variant="compact"` prop. In compact mode, the hint text appears as a tooltip on the label instead of being displayed below. This saves vertical space while still providing the hint information.

```tsx
// Default: hint text appears below the label
<field.Layout.Row label="Email" hintText="We'll never share your email">
  <field.Input ... />
</field.Layout.Row>

// Compact: hint text appears in tooltip when hovering the label
<field.Layout.Row label="Email" hintText="We'll never share your email" variant="compact">
  <field.Input ... />
</field.Layout.Row>

// Also works with Stack layout
<field.Layout.Stack label="Email" hintText="We'll never share your email" variant="compact">
  <field.Input ... />
</field.Layout.Stack>
```

**When to Use Compact**:

- Settings pages with many fields where vertical space is limited
- Forms where hint text is supplementary, not essential
- Dashboards or panels with constrained height

### Custom Layouts

You are allowed to create new layouts if necessary, or not use any layouts at all. Without a layout, you _should_ render `field.meta.Label` and optionally `field.meta.HintText` for a11y.

```tsx
<form.AppField name="firstName">
  {field => (
    <Flex gap="md">
      <field.Meta.Label required>First Name:</field.Meta.Label>
      <field.Input value={field.state.value ?? ''} onChange={field.handleChange} />
    </Flex>
  )}
</form.AppField>
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

Group related fields into sections with a title.

```tsx
<form.FieldGroup title="Personal Information">
  <form.AppField name="firstName">{/* ... */}</form.AppField>
  <form.AppField name="lastName">{/* ... */}</form.AppField>
</form.FieldGroup>

<form.FieldGroup title="Contact Information">
  <form.AppField name="email">{/* ... */}</form.AppField>
  <form.AppField name="phone">{/* ... */}</form.AppField>
</form.FieldGroup>
```

---

## Disabled State

Fields accept `disabled` as a boolean or string. When a string is provided, it displays as a tooltip explaining why the field is disabled.

```tsx
// ❌ Don't disable without explanation
<field.Input disabled value={field.state.value} onChange={field.handleChange} />

// ✅ Provide a reason when disabling
<field.Input
  disabled="This feature requires a Business plan"
  value={field.state.value}
  onChange={field.handleChange}
/>
```

---

## Validation with Zod

### Schema Definition

```tsx
import {z} from 'zod';

const userSchema = z.object({
  email: z.string().email('Please enter a valid email'),
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

### Conditional Fields

Use `form.Subscribe` to show/hide fields based on other field values:

```tsx
<form.Subscribe selector={state => state.values.plan === 'enterprise'}>
  {showBilling =>
    showBilling ? (
      <form.AppField name="billingEmail">
        {field => (
          <field.Layout.Stack label="Billing Email" required>
            <field.Input value={field.state.value} onChange={field.handleChange} />
          </field.Layout.Stack>
        )}
      </form.AppField>
    ) : null
  }
</form.Subscribe>
```

---

## Error Handling

### Server-Side Errors

Use `setFieldErrors` to display backend validation errors:

```tsx
import {useMutation} from '@tanstack/react-query';

import {setFieldErrors} from '@sentry/scraps/form';

import {fetchMutation} from 'sentry/utils/queryClient';

function MyForm() {
  const mutation = useMutation({
    mutationFn: (data: {email: string; username: string}) => {
      return fetchMutation({
        url: '/users/',
        method: 'POST',
        data,
      });
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {email: '', username: ''},
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
      try {
        await mutation.mutateAsync(value);
      } catch (error) {
        // Set field-specific errors from backend
        setFieldErrors(formApi, {
          email: {message: 'This email is already registered'},
          username: {message: 'Username is taken'},
        });
      }
    },
  });

  // ...
}
```

> **Important**: `setFieldErrors` supports nested paths with dot notation: `'address.city': {message: 'City not found'}`

### Error Display

Validation errors automatically show as a warning icon with tooltip in the field's trailing area. No additional code needed.

---

## Auto-Save Pattern

For settings pages where each field saves independently, use `AutoSaveField`.

### Basic Auto-Save Field

```tsx
import {z} from 'zod';

import {AutoSaveField} from '@sentry/scraps/form';

import {fetchMutation} from 'sentry/utils/queryClient';

const schema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
});

function SettingsForm() {
  return (
    <AutoSaveField
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
        <field.Layout.Row label="Display Name">
          <field.Input value={field.state.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}
```

### Auto-Save Behavior by Field Type

| Field Type        | When it saves                                               |
| ----------------- | ----------------------------------------------------------- |
| Input, TextArea   | On blur (when user leaves field)                            |
| Select (single)   | Immediately when selection changes                          |
| Select (multiple) | When menu closes, or when X/clear clicked while menu closed |
| Switch            | Immediately when toggled                                    |
| Range             | When user releases the slider, or immediately with keyboard |

### Auto-Save Status Indicators

The form system automatically shows:

- **Spinner** while saving (pending)
- **Checkmark** on success (fades after 2s)
- **Warning icon** on validation error (with tooltip)

### Confirmation Dialogs

For dangerous operations (security settings, permissions), use the `confirm` prop to show a confirmation modal before saving. The `confirm` prop accepts either a string or a function.

```tsx
<AutoSaveField
  name="require2FA"
  schema={schema}
  initialValue={false}
  confirm={value =>
    value
      ? 'This will remove all members without 2FA. Continue?'
      : 'Are you sure you want to allow members without 2FA?'
  }
  mutationOptions={{...}}
>
  {field => (
    <field.Layout.Row label="Require Two-Factor Auth">
      <field.Switch checked={field.state.value} onChange={field.handleChange} />
    </field.Layout.Row>
  )}
</AutoSaveField>
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
confirm="Are you sure you want to change this setting?"

// ✅ Only confirm when ENABLING (return undefined to skip)
confirm={value => value ? 'Are you sure you want to enable this?' : undefined}

// ✅ Only confirm when DISABLING
confirm={value => !value ? 'Disabling this removes security protection.' : undefined}

// ✅ Different messages for each direction
confirm={value =>
  value
    ? 'Enable 2FA requirement for all members?'
    : 'Allow members without 2FA?'
}

// ✅ For select fields - confirm specific values
confirm={value => value === 'delete' ? 'This will permanently delete all data!' : undefined}
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
    ...defaultFormOptions,
    defaultValues: {...},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  // ...
}
```

### Submit Button

```tsx
<Flex gap="md" justify="end">
  <Button onClick={() => form.reset()}>Reset</Button>
  <form.SubmitButton>Save Changes</form.SubmitButton>
</Flex>
```

The `SubmitButton` automatically:

- Disables while submission is pending
- Triggers form validation before submit

---

## Do's and Don'ts

### Form System Choice

```tsx
// ❌ Don't use legacy JsonForm for new forms
<JsonForm fields={[{name: 'email', type: 'text'}]} />;

// ✅ Use useScrapsForm with Zod validation
const form = useScrapsForm({
  ...defaultFormOptions,
  defaultValues: {email: ''},
  validators: {onDynamic: schema},
});
```

### Default Options

```tsx
// ❌ Don't forget defaultFormOptions
const form = useScrapsForm({
  defaultValues: {name: ''},
});

// ✅ Always spread defaultFormOptions first
const form = useScrapsForm({
  ...defaultFormOptions,
  defaultValues: {name: ''},
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
  return mutation.mutateAsync(value).catch(() => {});
};
```

### Field Value Handling

```tsx
// ❌ Don't use field.state.value directly when it might be undefined
<field.Input value={field.state.value} />

// ✅ Provide fallback for optional fields
<field.Input value={field.state.value ?? ''} />
```

### Validation Messages

```tsx
// ❌ Don't use generic error messages
z.string().min(1);

// ✅ Provide helpful, specific error messages
z.string().min(1, 'Email address is required');
```

### Auto-Save Cache Updates

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

### Auto-Save Mutation Typing with Mixed-Type Schemas

When using `AutoSaveField` with schemas that have mixed types (e.g., strings and booleans), the mutation options must be typed using the schema-inferred type. Using generic types like `Record<string, unknown>` breaks TanStack Form's ability to narrow field types.

```tsx
const preferencesSchema = z.object({
  theme: z.string(),
  language: z.string(),
  notifications: z.boolean(),
});

type Preferences = z.infer<typeof preferencesSchema>;

// ❌ Don't use generic types - breaks field type narrowing
const mutationOptions = mutationOptions({
  mutationFn: (data: Record<string, unknown>) => fetchMutation({...}),
});

// ✅ Use schema-inferred type for proper type narrowing
const mutationOptions = mutationOptions({
  mutationFn: (data: Partial<Preferences>) => fetchMutation({...}),
});
```

This ensures that when you use `name="theme"`, the field correctly infers `string` type, and `name="notifications"` infers `boolean` type.

### Layout Choice

```tsx
// ❌ Don't use Row layout when labels are very long
<field.Layout.Row label="Please enter the primary email address for your account">

// ✅ Use Stack layout for long labels
<field.Layout.Stack label="Please enter the primary email address for your account">
```

---

## Quick Reference Checklist

When creating a new form:

- [ ] Import from `@sentry/scraps/form` and `zod`
- [ ] Define Zod schema with helpful error messages
- [ ] Use `useScrapsForm` with `...defaultFormOptions`
- [ ] Set `defaultValues` matching schema shape
- [ ] Set `validators: {onDynamic: schema}`
- [ ] Wrap with `<form.AppForm>` and `<form.FormWrapper>`
- [ ] Use `<form.AppField>` for each field
- [ ] Choose appropriate layout (Stack or Row)
- [ ] Handle server errors with `setFieldErrors`
- [ ] Add `<form.SubmitButton>` for submission

When creating auto-save fields:

- [ ] Use `<AutoSaveField>` component
- [ ] Pass `schema` for validation
- [ ] Pass `initialValue` from current data
- [ ] Configure `mutationOptions` with `mutationFn`
- [ ] Update cache in `onSuccess` callback

---

## File References

| File                                                      | Purpose                     |
| --------------------------------------------------------- | --------------------------- |
| `static/app/components/core/form/scrapsForm.tsx`          | Main form hook              |
| `static/app/components/core/form/field/autoSaveField.tsx` | Auto-save wrapper           |
| `static/app/components/core/form/field/*.tsx`             | Individual field components |
| `static/app/components/core/form/layout/index.tsx`        | Layout components           |
| `static/app/components/core/form/form.stories.tsx`        | Usage examples              |
