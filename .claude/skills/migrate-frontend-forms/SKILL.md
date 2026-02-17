---
name: migrate-frontend-forms
description: Guide for migrating forms from the legacy JsonForm/FormModel system to the new TanStack-based form system.
---

# Form Migration Guide

This skill helps migrate forms from Sentry's legacy form system (JsonForm, FormModel) to the new TanStack-based system.

## Feature Mapping

| Old System           | New System          | Notes                                        |
| -------------------- | ------------------- | -------------------------------------------- |
| `saveOnBlur: true`   | `AutoSaveField`     | Default behavior                             |
| `confirm`            | `confirm` prop      | `string \| ((value) => string \| undefined)` |
| `showHelpInTooltip`  | `variant="compact"` | On layout components                         |
| `disabledReason`     | `disabled="reason"` | String shows tooltip                         |
| `extraHelp`          | JSX in layout       | Render `<Text>` below field                  |
| `getData`            | `mutationFn`        | Transform data in mutation function          |
| `mapFormErrors`      | `setFieldErrors`    | Transform API errors in catch block          |
| `saveMessage`        | `onSuccess`         | Show toast in mutation onSuccess callback    |
| `formatMessageValue` | `onSuccess`         | Control toast content in onSuccess callback  |
| `resetOnError`       | `onError`           | Call form.reset() in mutation onError        |
| `saveOnBlur: false`  | `useScrapsForm`     | Use regular form with explicit Save button   |
| `help`               | `hintText`          | On layout components                         |
| `label`              | `label`             | On layout components                         |
| `required`           | `required`          | On layout + Zod schema                       |

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
<AutoSaveField
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
<AutoSaveField
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
      <field.Switch checked={field.state.value} onChange={field.handleChange} />
    </field.Layout.Row>
  )}
</AutoSaveField>
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

**Important: Typing mutations with mixed-type schemas**

When using `AutoSaveField` with schemas that have mixed types (e.g., strings and booleans), the mutation function must be typed using the schema-inferred type. Using generic types like `Record<string, unknown>` breaks TanStack Form's ability to narrow field types based on the field name.

```tsx
const preferencesSchema = z.object({
  theme: z.string(),
  language: z.string(),
  notifications: z.boolean(),
});

type Preferences = z.infer<typeof preferencesSchema>;

// ❌ Don't use generic types - breaks field type narrowing
mutationOptions={{
  mutationFn: (data: Record<string, unknown>) => {
    return fetchMutation({url: '/user/', method: 'PUT', data: {options: data}});
  },
}}

// ✅ Use schema-inferred type for proper type narrowing
mutationOptions={{
  mutationFn: (data: Partial<Preferences>) => {
    return fetchMutation({url: '/user/', method: 'PUT', data: {options: data}});
  },
}}
```

### mapFormErrors → `setFieldErrors`

The `mapFormErrors` function transformed API error responses into field-specific errors. In the new system, handle this in the catch block using `setFieldErrors`.

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
import {setFieldErrors} from '@sentry/scraps/form';

const form = useScrapsForm({
  ...defaultFormOptions,
  defaultValues: {...},
  validators: {onDynamic: schema},
  onSubmit: async ({value, formApi}) => {
    try {
      await mutation.mutateAsync(value);
    } catch (error) {
      // Transform API errors and set on fields (equivalent to mapFormErrors)
      const responseJson = error.responseJSON;
      if (responseJson?.config) {
        // Flatten nested errors to dot notation
        const {config, ...rest} = responseJson;
        const errors: Record<string, {message: string}> = {};

        for (const [key, value] of Object.entries(rest)) {
          errors[key] = {message: Array.isArray(value) ? value[0] : String(value)};
        }
        for (const [key, value] of Object.entries(config)) {
          errors[`config.${key}`] = {message: Array.isArray(value) ? value[0] : String(value)};
        }

        setFieldErrors(formApi, errors);
      }
    }
  },
});
```

**Simpler pattern** - For flat error responses:

```tsx
onSubmit: async ({value, formApi}) => {
  try {
    await mutation.mutateAsync(value);
  } catch (error) {
    // API returns {email: ['Already taken'], username: ['Invalid']}
    const errors = error.responseJSON;
    if (errors) {
      setFieldErrors(formApi, {
        email: {message: errors.email?.[0]},
        username: {message: errors.username?.[0]},
      });
    }
  }
},
```

> **Note**: `setFieldErrors` supports nested paths with dot notation: `'config.schedule': {message: 'Invalid schedule'}`

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

<AutoSaveField
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

### resetOnError → `onError`

The `resetOnError` option reverted fields to their previous value when a save failed. In the new system, call `form.reset()` in the mutation's `onError` callback.

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
  ...defaultFormOptions,
  defaultValues: {password: ''},
  validators: {onDynamic: schema},
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

**New (with AutoSaveField):**

```tsx
<AutoSaveField
  name="enabled"
  schema={schema}
  initialValue={settings.enabled}
  mutationOptions={{
    mutationFn: data => fetchMutation({...}),
    onError: () => {
      // The field automatically shows error state via TanStack Query
      // If you need to reset the value, you can pass a reset callback
    },
  }}
>
```

> **Note**: AutoSaveField with TanStack Query already handles error states gracefully - the mutation's `isError` state is reflected in the UI. Manual reset is typically only needed for specific UX requirements like password fields.

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
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

const slugSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});

function SlugForm({project}: {project: Project}) {
  const mutation = useMutation({
    mutationFn: (data: {slug: string}) =>
      fetchMutation({url: `/projects/${org}/${project.slug}/`, method: 'PUT', data}),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {slug: project.slug},
    validators: {onDynamic: slugSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <form.AppForm>
      <form.AppField name="slug">
        {field => (
          <field.Layout.Stack label="Project Slug">
            <field.Input value={field.state.value} onChange={field.handleChange} />
          </field.Layout.Stack>
        )}
      </form.AppField>

      {/* Warning shown before saving (equivalent to saveMessage) */}
      <Alert variant="warning">
        {t("Changing a project's slug can break your build scripts!")}
      </Alert>

      <Flex gap="sm" justify="end">
        <Button onClick={() => form.reset()}>Cancel</Button>
        <form.SubmitButton>Save</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}
```

**When to use this pattern:**

- Dangerous operations where users should see a warning before committing (slug changes, security tokens)
- Large multiline text fields where you want to finish editing before saving (fingerprint rules, filters)
- Any field where auto-save doesn't make sense

## Intentionally Not Migrated

| Feature     | Usage   | Reason                                                                                |
| ----------- | ------- | ------------------------------------------------------------------------------------- |
| `allowUndo` | 3 forms | Undo in toasts adds complexity with minimal benefit. Use simple error toasts instead. |

## Migration Checklist

- [ ] Replace JsonForm/FormModel with useScrapsForm or AutoSaveField
- [ ] Convert field config objects to JSX AppField components
- [ ] Replace `help` → `hintText` on layouts
- [ ] Replace `showHelpInTooltip` → `variant="compact"`
- [ ] Replace `disabledReason` → `disabled="reason string"`
- [ ] Replace `extraHelp` → additional JSX in layout
- [ ] Convert `confirm` object to function: `(value) => message | undefined`
- [ ] Handle `getData` in mutationFn
- [ ] Handle `mapFormErrors` with setFieldErrors in catch
- [ ] Handle `saveMessage` in onSuccess callback
- [ ] Convert `saveOnBlur: false` fields to regular forms with Save button
- [ ] Verify `onSuccess` cache updates merge with existing data (use updater function) — some API endpoints may return partial objects
