---
name: migrate-frontend-forms
description: Guide for migrating forms from the legacy JsonForm/FormModel system to the new TanStack-based form system.
---

# Form Migration Guide

This skill helps migrate forms from Sentry's legacy form system (JsonForm, FormModel) to the new TanStack-based system.

## Feature Mapping

| Old System           | New System            | Notes                                                |
| -------------------- | --------------------- | ---------------------------------------------------- |
| `saveOnBlur: true`   | `AutoSaveForm`        | Default behavior                                     |
| `confirm`            | `confirm` prop        | `string \| ((value) => string \| undefined)`         |
| `showHelpInTooltip`  | `variant="compact"`   | On layout components                                 |
| `disabledReason`     | `disabled="reason"`   | String shows tooltip                                 |
| `extraHelp`          | JSX in layout         | Render `<Text>` below field                          |
| `getData`            | `mutationFn`          | Transform data in mutation function                  |
| `mapFormErrors`      | Request error adapter | Explicit for submit forms; provided for auto-save    |
| `saveMessage`        | `onSuccess`           | Show toast in mutation onSuccess callback            |
| `formatMessageValue` | `onSuccess`           | Control toast content in onSuccess callback          |
| `resetOnError`       | `catch`               | Call form.reset() when the mutation rejects          |
| `saveOnBlur: false`  | `useScrapsForm`       | Use regular form with explicit Save button           |
| (automatic)          | `form.reset()`        | Call after successful mutation if form stays on page |
| `help`               | `hintText`            | On layout components                                 |
| `label`              | `label`               | On layout components                                 |
| `required`           | `required`            | On layout + Zod schema                               |

## Feature Details

### confirm → `confirm` prop

**Old:**

```tsx
{
  name: 'require2FA',
  type: 'boolean',
  confirm: {
    true: 'Enable 2FA for all members?',
    false: 'Allow members without 2FA?',
  },
  isDangerous: true,
}
```

**New:**

```tsx
<AutoSaveForm
  name="require2FA"
  confirm={value =>
    value
      ? 'Enable 2FA for all members?'
      : 'Allow members without 2FA?'
  }
  {...}
>
```

### showHelpInTooltip → `variant="compact"`

**Old:**

```tsx
{
  name: 'field',
  help: 'This is help text',
  showHelpInTooltip: true,
}
```

**New:**

```tsx
<field.Layout.Row
  label="Field"
  hintText="This is help text"
  variant="compact"
>
```

### disabledReason → `disabled="reason"`

**Old:**

```tsx
{
  name: 'field',
  disabled: true,
  disabledReason: 'Requires Business plan',
}
```

**New:**

```tsx
<field.Input
  disabled="Requires Business plan"
  {...}
/>
```

### extraHelp → JSX

**Old:**

```tsx
{
  name: 'sensitiveFields',
  help: 'Main help text',
  extraHelp: 'Note: These fields apply org-wide',
}
```

**New:**

```tsx
<field.Layout.Stack label="Sensitive Fields" hintText="Main help text">
  <field.TextArea {...} />
  <Text size="sm" variant="muted">
    Note: These fields apply org-wide
  </Text>
</field.Layout.Stack>
```

### getData → `mutationFn`

The `getData` function transformed field data before sending to the API. In the new system, handle this in the `mutationFn`.

**Old:**

```tsx
// Wrap field value in 'options' key
{
  name: 'sentry:csp_ignored_sources_defaults',
  type: 'boolean',
  getData: data => ({options: data}),
}

// Or extract/transform specific fields
{
  name: 'slug',
  getData: (data: {slug?: string}) => ({slug: data.slug}),
}
```

**New:**

```tsx
<AutoSaveForm
  name="sentry:csp_ignored_sources_defaults"
  schema={schema}
  initialValue={project.options['sentry:csp_ignored_sources_defaults']}
  mutationOptions={{
    mutationFn: data => {
      // Transform data before API call (equivalent to getData)
      const transformed = {options: data};
      return fetchMutation({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        data: transformed,
      });
    },
  }}
>
  {field => (
    <field.Layout.Row label="Use default ignored sources">
      <field.Switch checked={field.value} onChange={field.handleChange} />
    </field.Layout.Row>
  )}
</AutoSaveForm>
```

**Simpler pattern** - If you just need to wrap the value:

```tsx
mutationOptions={{
  mutationFn: fieldData => {
    return fetchMutation({
      url: `/projects/${org}/${project}/`,
      method: 'PUT',
      data: {options: fieldData}, // getData equivalent
    });
  },
}}
```

**Important: Typing mutations correctly**

The `mutationFn` should be typed with the API's data type (e.g., `Partial<Organization>`, `Partial<Project>`), **not** the schema-inferred type. The schema is for client-side field validation only — the mutation receives whatever the API endpoint accepts. Tying the mutation to the schema couples two unrelated concerns and can cause type errors when the schema types don't exactly match the API types.

```tsx
// ❌ Don't use generic types - breaks field type narrowing
mutationOptions={{
  mutationFn: (data: Record<string, unknown>) => {
    return fetchMutation({url: '/user/', method: 'PUT', data: {options: data}});
  },
}}

// ❌ Don't tie mutation type to the zod schema
mutationOptions={{
  mutationFn: (data: Partial<z.infer<typeof preferencesSchema>>) => {
    return fetchMutation({url: '/user/', method: 'PUT', data: {options: data}});
  },
}}

// ✅ Use the API's data type
mutationOptions={{
  mutationFn: (data: Partial<UserDetails>) => {
    return fetchMutation({url: '/user/', method: 'PUT', data: {options: data}});
  },
}}
```

Make sure the zod schema's types are compatible with (i.e., assignable to) the API type. For example, if the API expects a string union like `'off' | 'low' | 'high'`, use `z.enum(['off', 'low', 'high'])` instead of `z.string()`.

**NEVER pass call-site generics to `useMutation`, `mutationOptions`, or any TanStack Query function.** This applies to ALL generics — data, error, variables, AND context. Types must be inferred, not asserted. See the full rules in `static/AGENTS.md` under "TanStack Query Type Inference."

```tsx
// ❌ Generics on useMutation — NEVER do this
const mutation = useMutation<CodeOwner, RequestError, [Payload]>({
  mutationFn: ([payload]) => fetchMutation({url, method: 'POST', data: payload}),
});

// ❌ Generics on mutationOptions — NEVER do this either
mutationOptions<unknown, RequestError, Variables, MyContext>({...})

// ❌ Explicit context type — inferred from onMutate return
type MyContext = {changeId: string};

// ❌ RequestError as error generic — it's a type assertion in disguise
// Other things can go wrong that would NOT yield a RequestError

// ✅ Type the mutationFn payload; fetchMutation<T> carries the return type
const mutation = useMutation({
  mutationFn: (payload: {codeMappingId: string; raw: string}) =>
    fetchMutation<CodeOwner>({
      url: `/projects/${org}/${project}/codeowners/`,
      method: 'POST',
      data: payload,
    }),
});

// ✅ Context is inferred from onMutate, error is Error by default
mutationOptions({
  mutationFn: (variables: MyVars) => fetchMutation<MyResponse>({...}),
  onMutate: async () => {
    return {changeId: uniqueId()};  // context type inferred from this
  },
  onError: (_error, _vars, context) => {
    // context?.changeId is typed automatically
    // _error is Error — use runtime narrowing for RequestError
  },
})
```

### mapFormErrors → `requestErrorToFieldErrors` + `toFieldErrors`

The `mapFormErrors` function transformed API error responses into field-specific errors. Two things changed:

- Scraps does not depend on Sentry's API client types, so convert a `RequestError` with `requestErrorToFieldErrors` at the call site — never pass it to Scraps directly.
- Validation errors are **returned** from `onSubmit` rather than set imperatively. Wrap the converted map with `createValidationError` from the submit context.

**Old:**

```tsx
// Form-level error transformer
function mapMonitorFormErrors(responseJson?: any) {
  if (responseJson.config === undefined) {
    return responseJson;
  }
  // Flatten nested config errors to dot notation
  const {config, ...rest} = responseJson;
  const configErrors = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [`config.${key}`, value])
  );
  return {...rest, ...configErrors};
}

<Form mapFormErrors={mapMonitorFormErrors} {...}>
```

**New:**

```tsx
const form = useScrapsForm({
  defaultValues: {...},
  validators: defaultFormValidators(schema),
  onSubmit: async ({value, createValidationError}) => {
    try {
      await mutation.mutateAsync(value);
    } catch (error) {
      if (!(error instanceof RequestError)) {
        throw error;
      }
      // Transform API errors into a field map (equivalent to mapFormErrors)
      const {config, ...rest} = error.responseJSON ?? {};
      const fields: Record<string, {message: string}> = {};

      for (const [key, val] of Object.entries(rest)) {
        fields[key] = {message: Array.isArray(val) ? val[0] : String(val)};
      }
      for (const [key, val] of Object.entries(config ?? {})) {
        fields[`config.${key}`] = {message: Array.isArray(val) ? val[0] : String(val)};
      }

      return createValidationError({fields});
    }
  },
});
```

**Simpler pattern** - For flat error responses, let the adapter do the extraction. It keeps only keys that exist on the form and returns `undefined` when nothing matched:

```tsx
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

onSubmit: ({value, createValidationError}) =>
  mutation.mutateAsync(value).catch(error => {
    // API returns {email: ['Already taken'], username: ['Invalid']}
    if (error instanceof RequestError) {
      const fields = requestErrorToFieldErrors(error, value);
      if (fields) {
        return createValidationError({fields});
      }
      addErrorMessage(t('Unable to save changes.'));
      return;
    }
    throw error;
  }),
```

For `AutoSaveForm`, request error handling is automatic. The Sentry form error
provider uses `requestErrorToFieldErrors` for field errors and
`getRequestErrorUserMessage` for request detail or status messages. Do not add
the submit-form catch block to each auto-save field.

> **Note**: Field paths support dot notation: `'config.schedule': {message: 'Invalid schedule'}`

> **Important**: Validation failures are **returned** from `onSubmit`. Thrown or rejected errors are submit failures. Keep transient network errors in the query layer and only return validation errors for things the user can fix in the form.

### saveMessage → `onSuccess`

The `saveMessage` showed a custom toast/alert after successful save. In the new system, handle this in the mutation's `onSuccess` callback.

**Old:**

```tsx
{
  name: 'fingerprintingRules',
  saveOnBlur: false,
  saveMessageAlertVariant: 'info',
  saveMessage: t('Changing fingerprint rules will apply to future events only.'),
}
```

**New:**

```tsx
import {addSuccessMessage} from 'sentry/actionCreators/indicator';

<AutoSaveForm
  name="fingerprintingRules"
  schema={schema}
  initialValue={project.fingerprintingRules}
  mutationOptions={{
    mutationFn: data => fetchMutation({...}),
    onSuccess: () => {
      // Custom success message (equivalent to saveMessage)
      addSuccessMessage(t('Changing fingerprint rules will apply to future events only.'));
    },
  }}
>
```

### formatMessageValue → `onSuccess`

The `formatMessageValue` controlled how the changed value appeared in success toasts. Setting it to `false` disabled showing the value entirely (useful for large text fields). In the new system, you control this directly in `onSuccess`.

**Old:**

```tsx
{
  name: 'fingerprintingRules',
  saveMessage: t('Rules updated'),
  formatMessageValue: false, // Don't show the (potentially huge) value in toast
}
```

**New:**

```tsx
mutationOptions={{
  mutationFn: data => fetchMutation({...}),
  onSuccess: () => {
    // Just show the message, no value (equivalent to formatMessageValue: false)
    addSuccessMessage(t('Rules updated'));
  },
}}

// Or if you want to show a formatted value:
onSuccess: (data) => {
  addSuccessMessage(t('Slug changed to %s', data.slug));
},
```

### resetOnError → reset in the `catch`

The `resetOnError` option reverted fields to their previous value when a save failed. In the new system, reset when the mutation rejects.

**Old:**

```tsx
// Form-level reset on error
<Form resetOnError apiEndpoint="/auth/" {...}>

// Or field-level (BooleanField always resets on error)
<FormField resetOnError name="enabled" {...}>
```

**New (with useScrapsForm):**

```tsx
const form = useScrapsForm({
  defaultValues: {password: ''},
  validators: defaultFormValidators(schema),
  onSubmit: async ({value}) => {
    try {
      await mutation.mutateAsync(value);
    } catch (error) {
      // Reset form to previous values on error (equivalent to resetOnError)
      form.reset();
      throw error; // Re-throw if you want error handling to continue
    }
  },
});
```

> **Important**: `form.reset()` cancels the submission that is still in flight, which discards any validation error you return from the same `onSubmit`. Reset _or_ return field errors — not both. If you need the value restored **and** the error shown, restore just that field instead:
>
> ```tsx
> form.setFieldValue(name, form.defaultValues[name], {
>   causeValidation: false,
>   markAsDirty: false,
>   markAsTouched: false,
> });
> return createValidationError({fields: {[name]: {message}}});
> ```

**New (with AutoSaveForm):**

`AutoSaveForm` already does this for immediate-commit controls — `field.Switch` and `field.Radio` revert to the previous value when the save fails, and the field shows the error inline. You do not need an `onError` callback for that.

```tsx
<AutoSaveForm
  name="enabled"
  schema={schema}
  initialValue={settings.enabled}
  mutationOptions={{
    mutationFn: data => fetchMutation({...}),
  }}
>
```

### Resetting After Save

When using `useScrapsForm` for a form that stays on the page after save, call `form.reset()` after a successful mutation. This re-syncs the form with updated `defaultValues` so it becomes pristine again — any UI that depends on the form being dirty (like conditionally shown Save/Cancel buttons) will update correctly.

```tsx
onSubmit: ({value}) =>
  mutation
    .mutateAsync(value)
    .then(() => form.reset())
    .catch(() => {}),
```

> **Note**: `AutoSaveForm` handles this automatically. You only need to add this when using `useScrapsForm`.

### saveOnBlur: false → `useScrapsForm`

Fields with `saveOnBlur: false` showed an inline alert with Save/Cancel buttons instead of auto-saving. This was used for dangerous operations (slug changes) or large text edits (fingerprint rules).

In the new system, use a regular form with `useScrapsForm` and an explicit Save button. This preserves the UX of showing warnings **before** committing.

**Old:**

```tsx
{
  name: 'slug',
  type: 'string',
  saveOnBlur: false,
  saveMessageAlertVariant: 'warning',
  saveMessage: t("Changing a project's slug can break your build scripts!"),
}
```

**New:**

```tsx
import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';

const slugSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});

function SlugForm({project}: {project: Project}) {
  const mutation = useMutation({
    mutationFn: (data: {slug: string}) =>
      fetchMutation({url: `/projects/${org}/${project.slug}/`, method: 'PUT', data}),
  });

  const form = useScrapsForm({
    defaultValues: {slug: project.slug},
    validators: defaultFormValidators(slugSchema),
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <ScrapsForm form={form}>
      <form.Field name="slug">
        {field => (
          <field.Layout.Stack label="Project Slug">
            <field.Input value={field.value} onChange={field.handleChange} />
          </field.Layout.Stack>
        )}
      </form.Field>

      {/* Warning shown before saving (equivalent to saveMessage) */}
      <Alert variant="warning">
        {t("Changing a project's slug can break your build scripts!")}
      </Alert>

      <Flex gap="sm" justify="end">
        <form.ResetButton>Reset</form.ResetButton>
        <form.SubmitButton>Save</form.SubmitButton>
      </Flex>
    </ScrapsForm>
  );
}
```

**When to use this pattern:**

- Dangerous operations where users should see a warning before committing (slug changes, security tokens)
- Large multiline text fields where you want to finish editing before saving (fingerprint rules, filters)
- Any field where auto-save doesn't make sense

**Submit through the form, not around it.** Follow the `SlugForm` pattern above — the mutation runs in `onSubmit` and the Save button is `<form.SubmitButton>`. Don't render `<ScrapsForm>` without an `onSubmit` and trigger the mutation from a standalone `<Button onClick>`:

```tsx
// ❌ Form is never submitted; mutation fires from a separate button
const form = useScrapsForm({
  defaultValues,
  validators: defaultFormValidators(schema),
  // no onSubmit
});

return (
  <ScrapsForm form={form}>
    <form.Field name="codeMappingId">{...}</form.Field>
    <Button onClick={() => mutation.mutate(...)}>Save</Button>
  </ScrapsForm>
);
```

A form that's never actually submitted bypasses validation, pending/disabled state, and field-error wiring.

## Preserving Form Search Functionality

Sentry's SettingsSearch allows users to search for individual settings fields. When migrating forms, you must preserve this searchability by wrapping migrated forms with `FormSearch`.

### The `FormSearch` Component

`FormSearch` is a **build-time marker component** — it has zero runtime behavior and simply renders its children unchanged. Its `route` prop is read by a static extraction script to associate form fields with their navigation route, enabling them to appear in SettingsSearch results.

```tsx
import {FormSearch} from '@sentry/scraps/form';

<FormSearch route="/settings/account/details/">
  <FieldGroup title={t('Account Details')}>
    <AutoSaveForm name="name" schema={schema} initialValue={user.name} mutationOptions={...}>
      {field => (
        <field.Layout.Row label={t('Name')} hintText={t('Your full name')} required>
          <field.Input value={field.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  </FieldGroup>
</FormSearch>
```

**Props:**

| Prop       | Type        | Description                                                                                          |
| ---------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `route`    | `string`    | The settings route for this form (e.g., `'/settings/account/details/'`). Used for search navigation. |
| `children` | `ReactNode` | The form content — rendered unchanged at runtime.                                                    |

**Rules:**

- The `route` must match the settings page URL exactly (including trailing slash).
- Wrap the **entire form section** with a single `FormSearch`, not individual fields.
- Every `<AutoSaveForm>`, `<form.Field>` or `<form.ArrayField>` inside a `FormSearch` will be indexed. Make sure `label` and `hintText` are plain string literals or `t()` calls — computed/dynamic strings will be skipped by the extractor.

### The Form Field Registry

After adding or updating `FormSearch` wrappers, regenerate the field registry so that search results stay up to date:

```bash
pnpm run extract-form-fields
```

This script (`scripts/extractFormFields.ts`) scans all TSX files, finds `<FormSearch>` wrappers and the form fields inside them, extracts field metadata (`name`, `label`, `hintText`, `route`), and writes the generated registry to `static/app/views/settings/fieldRegistry.generated.ts`. **Commit this generated file** alongside your migration PR — it is part of the source tree.

> Run the command after **any** change to forms inside a `FormSearch` wrapper (adds, removals, label changes). The generated file is checked in and should not be edited manually.

### Migration: Old Forms Already Searchable

If the legacy `JsonForm` being migrated was already indexed by SettingsSearch (i.e., it had entries in `sentry/data/forms`), you **must** add a `FormSearch` wrapper to the new form so search functionality is preserved. The old and new sources coexist — new registry entries take precedence over old ones for the same route + field combination — but once you remove the legacy form the old entries will disappear.

## Handling Nullable Initial Values

Legacy select fields often started with an empty/undefined value and required a selection. In the new system, use `.nullable().refine()` in the schema, type `defaultValues` with `z.input<typeof schema>`, and call `schema.parse(value)` in `onSubmit`.

**Old:**

```tsx
{
  name: 'provider',
  type: 'select',
  required: true,
  choices: [['github', 'GitHub'], ['launchdarkly', 'LaunchDarkly']],
}
```

**New:**

```tsx
const schema = z.object({
  provider: z
    .enum(['github', 'launchdarkly'])
    .nullable()
    .refine(v => v !== null, 'Provider is required'),
});

// z.input accepts null; z.output (after refine) does not
const defaultValues: z.input<typeof schema> = {
  provider: null,
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

This pattern is necessary whenever a required field has no meaningful initial value. The `z.input` / `z.output` distinction ensures the form accepts `null` as default while the mutation receives the validated, non-null type.

## Intentionally Not Migrated

| Feature     | Usage   | Reason                                                                                |
| ----------- | ------- | ------------------------------------------------------------------------------------- |
| `allowUndo` | 3 forms | Undo in toasts adds complexity with minimal benefit. Use simple error toasts instead. |

## Migration Checklist

- [ ] Replace JsonForm/FormModel with `useScrapsForm` (wrapped in `<ScrapsForm form={form}>`) or `AutoSaveForm`
- [ ] Set `validators: defaultFormValidators(schema)` — validators are an array, not an event-keyed object
- [ ] No generics on `useMutation` — type the `mutationFn` payload and use `fetchMutation<T>` for the return type
- [ ] When using `useScrapsForm` with a Save button: mutation runs in `onSubmit`, triggered by `<form.SubmitButton>` (no form that's never submitted)
- [ ] Convert field config objects to JSX `<form.Field>` components (`<form.ArrayField>` for lists)
- [ ] Replace `help` → `hintText` on layouts
- [ ] Replace `showHelpInTooltip` → `variant="compact"`
- [ ] Replace `disabledReason` → `disabled="reason string"`
- [ ] Replace `extraHelp` → additional JSX in layout
- [ ] Convert `confirm` object to function: `(value) => message | undefined`
- [ ] Handle `getData` in mutationFn
- [ ] For submit forms, narrow to `RequestError`, convert with `requestErrorToFieldErrors`, then return `createValidationError({fields})` from `onSubmit`
- [ ] For `AutoSaveForm`, rely on the app-provided request error handling
- [ ] Keep custom error mapping only when `mapFormErrors` reshaped the API response
- [ ] Handle `saveMessage` in onSuccess callback
- [ ] Convert `saveOnBlur: false` fields to regular forms with Save button
- [ ] Call `form.reset()` after successful mutation (for forms that stay on page)
- [ ] Verify `onSuccess` cache updates merge with existing data (use updater function) — some API endpoints may return partial objects
- [ ] Wrap the migrated form with `<FormSearch route="...">` if the old form was searchable in SettingsSearch
- [ ] Run `pnpm run extract-form-fields` and commit the updated `fieldRegistry.generated.ts`
