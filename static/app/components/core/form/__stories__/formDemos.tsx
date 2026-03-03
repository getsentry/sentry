/**
 * Demo components for form .mdx documentation.
 *
 * Extracted into a .tsx file because prettier's MDX parser flattens JSX
 * indentation inside exported functions when dotted component names are used
 * (e.g. form.AppForm, field.Layout.Row).
 */
import {z} from 'zod';

import {
  AutoSaveField,
  defaultFormOptions,
  FieldGroup,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

// ──────────────────────────────────────────────
// form.mdx demos
// ──────────────────────────────────────────────

const quickStartSchema = z.object({
  email: z.email('Please enter a valid email'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export function QuickStartDemo() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      email: '',
      name: '',
    },
    validators: {
      onDynamic: quickStartSchema,
    },
    onSubmit: ({value}) => {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value, null, 2));
    },
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup title="Quick Start">
        <form.AppField name="name">
          {field => (
            <field.Layout.Row label="Name" required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="Enter your name"
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="email">
          {field => (
            <field.Layout.Row label="Email" required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="you@example.com"
              />
            </field.Layout.Row>
          )}
        </form.AppField>
      </form.FieldGroup>
      <Flex gap="md" justify="end">
        <form.SubmitButton>Submit</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}

export function CompactDemo() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {field1: '', field2: '', field3: '', field4: ''},
  });

  return (
    <form.AppForm form={form}>
      <FieldGroup title="Row Layout">
        <form.AppField name="field1">
          {field => (
            <field.Layout.Row
              label="Default Variant"
              hintText="This hint text appears below the label"
            >
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="field2">
          {field => (
            <field.Layout.Row
              label="Compact Variant"
              hintText="This hint text appears in a tooltip when hovering the label"
              variant="compact"
            >
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.AppField>
      </FieldGroup>
      <FieldGroup title="Stack Layout">
        <form.AppField name="field3">
          {field => (
            <field.Layout.Stack
              label="Default Variant"
              hintText="This hint text appears below the input"
            >
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="field4">
          {field => (
            <field.Layout.Stack
              label="Compact Variant"
              hintText="This hint text appears in a tooltip when hovering the label"
              variant="compact"
            >
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.AppField>
      </FieldGroup>
    </form.AppForm>
  );
}

const conditionalSchema = z.object({
  plan: z.string(),
  billingEmail: z.email('Please enter a valid email'),
});

export function ConditionalDemo() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {plan: 'free', billingEmail: ''},
    validators: {onDynamic: conditionalSchema},
    onSubmit: ({value}) => {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value, null, 2));
    },
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup title="Conditional Fields">
        <form.AppField name="plan">
          {field => (
            <field.Layout.Row label="Plan">
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={[
                  {value: 'free', label: 'Free'},
                  {value: 'enterprise', label: 'Enterprise'},
                ]}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.Subscribe selector={state => state.values.plan === 'enterprise'}>
          {showBilling =>
            showBilling ? (
              <form.AppField name="billingEmail">
                {field => (
                  <field.Layout.Row label="Billing Email" required>
                    <field.Input
                      value={field.state.value ?? ''}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>
            ) : null
          }
        </form.Subscribe>
      </form.FieldGroup>
      <Flex gap="md" justify="end">
        <form.SubmitButton>Submit</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}

// ──────────────────────────────────────────────
// fields.mdx demos
// ──────────────────────────────────────────────

export function BaseFieldDemo() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {color: '#3c74dd'},
    validators: {
      onDynamic: z.object({
        color: z.string().min(1, 'Please select a color'),
      }),
    },
    onSubmit: ({value}) => {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value, null, 2));
    },
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup title="Custom Field">
        <form.AppField name="color">
          {field => (
            <field.Layout.Row label="Brand Color:">
              <field.Base<HTMLInputElement>>
                {(baseProps, {indicator}) => (
                  <Flex flexGrow={1}>
                    <input
                      {...baseProps}
                      type="color"
                      value={field.state.value}
                      onChange={e => field.handleChange(e.target.value)}
                    />
                    {indicator}
                  </Flex>
                )}
              </field.Base>
            </field.Layout.Row>
          )}
        </form.AppField>
      </form.FieldGroup>
      <Flex gap="md" justify="end">
        <form.SubmitButton>Submit</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}

// ──────────────────────────────────────────────
// autoSaveField.mdx demos
// ──────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const basicSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
});

const basicMutationOptions = {
  mutationFn: async (data: Record<string, unknown>) => {
    await sleep(1000);
    return data;
  },
};

export function BasicAutoSaveDemo() {
  return (
    <FieldGroup title="Profile Settings">
      <AutoSaveField
        name="displayName"
        schema={basicSchema}
        initialValue="Jane Doe"
        mutationOptions={basicMutationOptions}
      >
        {field => (
          <field.Layout.Row label="Display Name">
            <field.Input value={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    </FieldGroup>
  );
}

const fullSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  notifications: z.boolean().optional(),
  priority: z.string().optional(),
  bio: z.string().optional(),
  volume: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
});

const TAG_OPTIONS = [
  {value: 'bug', label: 'Bug'},
  {value: 'feature', label: 'Feature'},
  {value: 'enhancement', label: 'Enhancement'},
];

export function FullAutoSaveDemo() {
  const fullMutationOptions = {
    mutationFn: async (data: Record<string, unknown>) => {
      await sleep(1000);
      return data;
    },
  };

  return (
    <FieldGroup title="User Settings">
      <AutoSaveField
        name="firstName"
        schema={fullSchema}
        initialValue="Jane"
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label="First Name" hintText="Your given name">
            <field.Input value={field.state.value ?? ''} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="lastName"
        schema={fullSchema}
        initialValue="Doe"
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label="Last Name" required>
            <field.Input value={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="notifications"
        schema={fullSchema}
        initialValue={false}
        mutationOptions={fullMutationOptions}
        confirm={value =>
          value
            ? 'Are you sure you want to enable notifications?'
            : 'Disabling notifications means you may miss important updates.'
        }
      >
        {field => (
          <field.Layout.Row label="Email Notifications">
            <field.Switch
              checked={field.state.value ?? false}
              onChange={field.handleChange}
            />
          </field.Layout.Row>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="tags"
        schema={fullSchema}
        initialValue={[]}
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label="Tags" hintText="Select multiple tags">
            <field.Select
              multiple
              value={field.state.value ?? []}
              onChange={field.handleChange}
              options={TAG_OPTIONS}
            />
          </field.Layout.Row>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="priority"
        schema={fullSchema}
        initialValue="medium"
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Radio.Group
            value={field.state.value ?? ''}
            onChange={field.handleChange}
          >
            <field.Layout.Row label="Priority" hintText="Select issue priority">
              <Flex gap="lg">
                <field.Radio.Item value="low">Low</field.Radio.Item>
                <field.Radio.Item value="medium">Medium</field.Radio.Item>
                <field.Radio.Item value="high">High</field.Radio.Item>
              </Flex>
            </field.Layout.Row>
          </field.Radio.Group>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="bio"
        schema={fullSchema}
        initialValue=""
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label="Bio" hintText="Tell us about yourself">
            <field.TextArea
              value={field.state.value ?? ''}
              onChange={field.handleChange}
            />
          </field.Layout.Row>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="volume"
        schema={fullSchema}
        initialValue={50}
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label="Volume">
            <field.Range
              value={field.state.value ?? 50}
              onChange={field.handleChange}
              min={0}
              max={100}
              step={10}
            />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    </FieldGroup>
  );
}
