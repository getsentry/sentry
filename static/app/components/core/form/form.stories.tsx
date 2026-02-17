import {Fragment} from 'react';
import {TanStackDevtools} from '@tanstack/react-devtools';
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools';
import {
  mutationOptions,
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  AutoSaveField,
  defaultFormOptions,
  FieldGroup,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';

const COUNTRY_OPTIONS = [
  {value: 'US', label: 'United States'},
  {value: 'CA', label: 'Canada'},
  {value: 'AT', label: 'Austria'},
];

const TAG_OPTIONS = [
  {value: 'bug', label: 'Bug'},
  {value: 'feature', label: 'Feature'},
  {value: 'enhancement', label: 'Enhancement'},
  {value: 'docs', label: 'Documentation'},
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const baseUserSchema = z.object({
  age: z.number('Age is required').gte(13, 'You must be 13 to make an account'),
  firstName: z.string().optional(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  secret: z.string().optional(),
  notifications: z.boolean().optional(),
  volume: z.number().min(0).max(100).optional(),
  bio: z.string().optional(),
  tags: z.array(z.string()).optional(),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    country: z.string().min(1, 'Country is required'),
  }),
});

const userSchema = baseUserSchema.refine(
  data => {
    if (data.age === 42) {
      return !!data.secret && data.secret.length > 0;
    }
    return true;
  },
  {
    message: 'Secret is required when age is 42',
    path: ['secret'],
  }
);

const userQuery = queryOptions({
  queryKey: ['user', 'example'],
  queryFn: async () => {
    await sleep(500);
    return userSchema.parse({
      firstName: 'John',
      lastName: 'Doe',
      age: 23,
      address: {
        street: '123 Main St',
        city: 'Anytown',
        country: 'US',
      },
    });
  },
});

type User = z.infer<typeof baseUserSchema>;

const addressMutationOptions = (client: QueryClient) =>
  mutationOptions({
    mutationFn: async (variables: Partial<User['address']>): Promise<User['address']> => {
      // eslint-disable-next-line no-console
      console.log('saving address', variables);
      await sleep(1000);
      return {
        street: '123 Main St',
        city: 'Anytown',
        country: 'US',
        ...variables,
      };
    },
    onSuccess: data => {
      client.setQueryData(['user', 'example'], oldData => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          address: data,
        };
      });
    },
  });

const userMutationOptions = (client: QueryClient) =>
  mutationOptions({
    mutationFn: async (variables: Partial<User>): Promise<User> => {
      // eslint-disable-next-line no-console
      console.log('saving user', variables);
      await sleep(1000);
      return {
        firstName: 'John',
        lastName: 'Doe',
        age: 23,
        address: {
          street: '123 Main St',
          city: 'Anytown',
          country: 'US',
        },
        ...variables,
      };
    },
    onSuccess: data => {
      client.setQueryData(['user', 'example'], data);
    },
  });

function AutoSaveExample() {
  const user = useQuery(userQuery);
  const client = useQueryClient();

  if (user.isPending) {
    return <div>Loading...</div>;
  }

  return (
    <FieldGroup title="AutoSave Example">
      <AutoSaveField
        name="firstName"
        schema={baseUserSchema}
        initialValue={user.data?.firstName ?? ''}
        mutationOptions={userMutationOptions(client)}
      >
        {field => (
          <field.Layout.Stack label="First Name:" hintText="Your given name">
            <field.Input value={field.state.value ?? ''} onChange={field.handleChange} />
          </field.Layout.Stack>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="lastName"
        schema={baseUserSchema}
        initialValue={user.data?.lastName ?? ''}
        mutationOptions={userMutationOptions(client)}
      >
        {field => (
          <field.Layout.Stack label="Last Name:" hintText="Your family name" required>
            <field.Input value={field.state.value} onChange={field.handleChange} />
          </field.Layout.Stack>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="country"
        schema={baseUserSchema.shape.address}
        initialValue={user.data?.address.country ?? ''}
        mutationOptions={addressMutationOptions(client)}
      >
        {field => (
          <field.Layout.Stack label="Country:" required>
            <field.Select
              value={field.state.value}
              onChange={field.handleChange}
              options={COUNTRY_OPTIONS}
            />
          </field.Layout.Stack>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="tags"
        schema={baseUserSchema}
        initialValue={user.data?.tags ?? []}
        mutationOptions={userMutationOptions(client)}
      >
        {field => (
          <field.Layout.Stack label="Tags" hintText="Select multiple tags">
            <field.Select
              multiple
              value={field.state.value ?? []}
              onChange={field.handleChange}
              options={TAG_OPTIONS}
            />
          </field.Layout.Stack>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="notifications"
        schema={baseUserSchema}
        initialValue={user.data?.notifications ?? false}
        mutationOptions={userMutationOptions(client)}
        confirm={value =>
          value
            ? 'Are you sure you want to enable email notifications?'
            : 'Disabling notifications means you may miss important updates.'
        }
      >
        {field => (
          <field.Layout.Stack label="Email Notifications:">
            <field.Switch
              checked={field.state.value ?? false}
              onChange={field.handleChange}
            />
          </field.Layout.Stack>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="bio"
        schema={baseUserSchema}
        initialValue={user.data?.bio ?? ''}
        mutationOptions={userMutationOptions(client)}
      >
        {field => (
          <field.Layout.Stack label="Bio:" hintText="Tell us about yourself">
            <field.TextArea
              value={field.state.value ?? ''}
              onChange={field.handleChange}
            />
          </field.Layout.Stack>
        )}
      </AutoSaveField>

      <AutoSaveField
        name="volume"
        schema={baseUserSchema}
        initialValue={user.data?.volume ?? 50}
        mutationOptions={userMutationOptions(client)}
      >
        {field => (
          <field.Layout.Stack label="Volume:">
            <field.Range
              value={field.state.value ?? 50}
              onChange={field.handleChange}
              min={0}
              max={100}
              step={10}
            />
          </field.Layout.Stack>
        )}
      </AutoSaveField>
    </FieldGroup>
  );
}

function BasicForm() {
  const user = useQuery(userQuery);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: user.data,
    validators: {
      onDynamic: baseUserSchema,
    },
    onSubmit: ({value, formApi}) => {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value));
      setFieldErrors(formApi, {
        firstName: {message: 'This name is already taken'},
      });
    },
  });

  if (user.isPending) {
    return <div>Loading...</div>;
  }

  return (
    <form.AppForm>
      <form.FormWrapper>
        <form.FieldGroup title="Peronal Information">
          <form.AppField name="firstName">
            {field => (
              <field.Layout.Row label="First Name:" hintText="Your given name">
                <field.Input
                  value={field.state.value ?? ''}
                  onChange={field.handleChange}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="lastName">
            {field => (
              <field.Layout.Row label="Last Name:" hintText="Your family name" required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled="Can't touch this"
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="age">
            {field => (
              <field.Layout.Row label="Age:" hintText="Minimum 13" required>
                <field.Number value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="notifications">
            {field => (
              <field.Layout.Row
                label="Email Notifications:"
                hintText="Receive email updates"
              >
                <field.Switch
                  checked={field.state.value ?? false}
                  onChange={field.handleChange}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="bio">
            {field => (
              <field.Layout.Row label="Bio:" hintText="Tell us about yourself">
                <field.TextArea
                  value={field.state.value ?? ''}
                  onChange={field.handleChange}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="volume">
            {field => (
              <field.Layout.Row label="Volume:" hintText="Adjust the volume level">
                <field.Range
                  value={field.state.value ?? 50}
                  onChange={field.handleChange}
                  min={0}
                  max={100}
                  step={10}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="tags">
            {field => (
              <field.Layout.Row label="Tags:" hintText="Select multiple tags">
                <field.Select
                  multiple
                  value={field.state.value ?? []}
                  onChange={field.handleChange}
                  options={TAG_OPTIONS}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.Subscribe selector={state => state.values.age === 42}>
            {showSecret =>
              showSecret ? (
                <form.AppField
                  name="secret"
                  validators={{
                    onDynamic: z
                      .string('Secret is required when age is 42')
                      .min(1, 'Secret is required when age is 42'),
                  }}
                >
                  {field => (
                    <field.Layout.Row
                      label="Secret:"
                      hintText="Secret is required when age is 42"
                      required
                    >
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

        <form.FieldGroup title="Address Information">
          <form.AppField name="address.street">
            {field => (
              <field.Layout.Row label="Street:" required>
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="address.city">
            {field => (
              <field.Layout.Row label="City:" required>
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="address.country">
            {field => (
              <field.Layout.Row label="Country:" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={COUNTRY_OPTIONS}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        </form.FieldGroup>

        <Flex gap="md" justify="end">
          <Button onClick={() => form.reset()}>Reset</Button>
          <form.SubmitButton>Submit</form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}

function CompactExample() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      field1: '',
      field2: '',
      field3: '',
      field4: '',
    },
  });

  return (
    <form.AppForm>
      <form.FormWrapper>
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
      </form.FormWrapper>
    </form.AppForm>
  );
}

export default Storybook.story('Form', story => {
  story('Basic', () => {
    return (
      <Fragment>
        <BasicForm />
        <TanStackDevtools plugins={[formDevtoolsPlugin()]} />
      </Fragment>
    );
  });

  story('AutoSave', () => {
    return (
      <Fragment>
        <AutoSaveExample />
      </Fragment>
    );
  });

  story('Compact Variant', () => {
    return <CompactExample />;
  });
});
