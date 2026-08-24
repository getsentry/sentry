/**
 * Demo components for form .mdx documentation.
 *
 * Extracted into a .tsx file because prettier's MDX parser flattens JSX
 * indentation inside exported functions when dotted component names are used
 * (e.g. form.Field, field.Layout.Row).
 */

import {useState} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {
  defaultFormValidators,
  ScrapsForm,
  AutoSaveForm,
  FieldGroup,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

// form.mdx demos

const quickStartSchema = z.object({
  email: z.email('Please enter a valid email'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export function QuickStartDemo() {
  const form = useScrapsForm({
    defaultValues: {
      email: '',
      name: '',
    },
    validators: defaultFormValidators(quickStartSchema),
    onSubmit: async ({value}) => {
      await sleep(1000);
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value, null, 2));
    },
  });

  return (
    <ScrapsForm form={form}>
      <form.FieldGroup title={t('Quick Start')}>
        <form.Field name="name">
          {field => (
            <field.Layout.Row label={t('Name')} required>
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder={t('Enter your name')}
              />
            </field.Layout.Row>
          )}
        </form.Field>
        <form.Field name="email">
          {field => (
            <field.Layout.Row label={t('Email')} required>
              <field.Input
                value={field.value}
                onChange={field.handleChange}
                placeholder={t('you@example.com')}
              />
            </field.Layout.Row>
          )}
        </form.Field>
      </form.FieldGroup>
      <Flex gap="md" justify="end">
        <form.SubmitButton>Submit</form.SubmitButton>
      </Flex>
    </ScrapsForm>
  );
}

export function CompactDemo() {
  const form = useScrapsForm({
    defaultValues: {field1: '', field2: '', field3: '', field4: ''},
  });

  return (
    <ScrapsForm form={form}>
      <FieldGroup title={t('Row Layout')}>
        <form.Field name="field1">
          {field => (
            <field.Layout.Row
              label={t('Default Variant')}
              hintText={t('This hint text appears below the label')}
            >
              <field.Input value={field.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.Field>
        <form.Field name="field2">
          {field => (
            <field.Layout.Row
              label={t('Compact Variant')}
              hintText={t('This hint text appears in a tooltip when hovering the label')}
              variant="compact"
            >
              <field.Input value={field.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.Field>
      </FieldGroup>
      <FieldGroup title={t('Stack Layout')}>
        <form.Field name="field3">
          {field => (
            <field.Layout.Stack
              label={t('Default Variant')}
              hintText={t('This hint text appears below the input')}
            >
              <field.Input value={field.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="field4">
          {field => (
            <field.Layout.Stack
              label={t('Compact Variant')}
              hintText={t('This hint text appears in a tooltip when hovering the label')}
              variant="compact"
            >
              <field.Input value={field.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.Field>
      </FieldGroup>
    </ScrapsForm>
  );
}

const conditionalSchema = z.object({
  plan: z.string(),
  billingEmail: z.string(),
});

export function ConditionalDemo() {
  const form = useScrapsForm({
    defaultValues: {plan: 'free', billingEmail: ''},
    validators: defaultFormValidators(conditionalSchema),
    onSubmit: ({value}) => {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value, null, 2));
    },
  });

  return (
    <ScrapsForm form={form}>
      <form.FieldGroup title={t('Conditional Fields')}>
        <form.Field name="plan">
          {field => (
            <field.Layout.Row label={t('Plan')}>
              <field.Select
                value={field.value}
                onChange={field.handleChange}
                options={[
                  {value: 'free', label: 'Free'},
                  {value: 'enterprise', label: 'Enterprise'},
                ]}
              />
            </field.Layout.Row>
          )}
        </form.Field>
        <form.Subscribe selector={state => state.values.plan === 'enterprise'}>
          {showBilling =>
            showBilling ? (
              <form.Field
                name="billingEmail"
                validators={[
                  {
                    run: z.email(t('Please enter a valid email')),
                    triggers: ['change'],
                  },
                ]}
              >
                {field => (
                  <field.Layout.Row label={t('Billing Email')} required>
                    <field.Input
                      value={field.value ?? ''}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Row>
                )}
              </form.Field>
            ) : null
          }
        </form.Subscribe>
      </form.FieldGroup>
      <Flex gap="md" justify="end">
        <form.SubmitButton>Submit</form.SubmitButton>
      </Flex>
    </ScrapsForm>
  );
}

// fields.mdx demos

export function BaseFieldDemo() {
  const form = useScrapsForm({
    defaultValues: {color: '#3c74dd'},
    validators: defaultFormValidators(
      z.object({
        color: z.string().min(1, 'Please select a color'),
      })
    ),
    onSubmit: ({value}) => {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value, null, 2));
    },
  });

  return (
    <ScrapsForm form={form}>
      <form.FieldGroup title={t('Custom Field')}>
        <form.Field name="color">
          {field => (
            <field.Layout.Stack label={t('Brand Color:')}>
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
            </field.Layout.Stack>
          )}
        </form.Field>
      </form.FieldGroup>
      <Flex gap="md" justify="end">
        <form.SubmitButton>Submit</form.SubmitButton>
      </Flex>
    </ScrapsForm>
  );
}

// autoSaveForm.mdx demos

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const basicSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
});

export function BasicAutoSaveDemo() {
  // Simulated server state for demonstration
  const [serverState, setServerState] = useState({displayName: 'Jane Doe'});

  const basicMutationOptions = mutationOptions({
    mutationFn: async (data: {displayName: string}) => {
      await sleep(1000);
      return data;
    },
    onSuccess: data => {
      setServerState({displayName: data.displayName.toUpperCase()});
    },
  });

  return (
    <FieldGroup title={t('Profile Settings')}>
      <AutoSaveForm
        name="displayName"
        schema={basicSchema}
        initialValue={serverState.displayName}
        mutationOptions={basicMutationOptions}
      >
        {field => (
          <field.Layout.Row label={t('Display Name')}>
            <field.Input value={field.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}

const fullSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
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
    <FieldGroup title={t('User Settings')}>
      <AutoSaveForm
        name="name"
        schema={fullSchema}
        initialValue="Jane Doe"
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label={t('Full Name')} required>
            <field.Input value={field.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
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
          <field.Layout.Row label={t('Email Notifications')}>
            <field.Switch checked={field.value ?? false} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="tags"
        schema={fullSchema}
        initialValue={[]}
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label={t('Tags')} hintText={t('Select multiple tags')}>
            <field.Select
              multiple
              value={field.value ?? []}
              onChange={field.handleChange}
              options={TAG_OPTIONS}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="priority"
        schema={fullSchema}
        initialValue="medium"
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Radio.Group value={field.value ?? ''} onChange={field.handleChange}>
            <field.Layout.Row label={t('Priority')} hintText={t('Select issue priority')}>
              <Flex gap="lg">
                <field.Radio.Item value="low">{t('Low')}</field.Radio.Item>
                <field.Radio.Item value="medium">{t('Medium')}</field.Radio.Item>
                <field.Radio.Item value="high">{t('High')}</field.Radio.Item>
              </Flex>
            </field.Layout.Row>
          </field.Radio.Group>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="bio"
        schema={fullSchema}
        initialValue=""
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label={t('Bio')} hintText={t('Tell us about yourself')}>
            <field.TextArea value={field.value ?? ''} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="volume"
        schema={fullSchema}
        initialValue={50}
        mutationOptions={fullMutationOptions}
      >
        {field => (
          <field.Layout.Row label={t('Volume')}>
            <field.Range
              value={field.value ?? 50}
              onChange={field.handleChange}
              min={0}
              max={100}
              step={10}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
