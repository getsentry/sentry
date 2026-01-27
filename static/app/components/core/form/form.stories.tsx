import {Fragment} from 'react';
import {TanStackDevtools} from '@tanstack/react-devtools';
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools';
import {mutationOptions, queryOptions, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {AutoSaveField} from '@sentry/scraps/form/fields/autoSaveField';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form/scrapsForm';
import {Flex} from '@sentry/scraps/layout';

import {Stack} from 'sentry/components/core/layout/stack';
import * as Storybook from 'sentry/stories';

const COUNTRY_OPTIONS = [
  {value: 'US', label: 'United States'},
  {value: 'CA', label: 'Canada'},
  {value: 'AT', label: 'Austria'},
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const baseUserSchema = z.object({
  age: z.number('Age is required').gte(13, 'You must be 13 to make an account'),
  firstName: z.string().optional(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  secret: z.string().optional(),
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

const userMutationOptions = mutationOptions({
  mutationFn: async (variables: Partial<User>): Promise<User> => {
    // eslint-disable-next-line no-console
    console.log('saving lastName', variables);
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
});

function TanStackAutoSave() {
  const user = useQuery(userQuery);

  if (user.isPending) {
    return <div>Loading...</div>;
  }

  return (
    <Stack gap="lg">
      <AutoSaveField
        name="firstName"
        schema={baseUserSchema}
        initialValue={user.data?.firstName ?? ''}
        mutationOptions={userMutationOptions}
      >
        {field => (
          <field.Input
            label="First Name:"
            value={field.state.value ?? ''}
            onChange={field.handleChange}
          />
        )}
      </AutoSaveField>

      <AutoSaveField
        name="lastName"
        schema={baseUserSchema}
        initialValue={user.data?.lastName ?? ''}
        mutationOptions={userMutationOptions}
      >
        {field => (
          <field.Input
            label="Last Name:"
            required
            hintText="Your family name"
            value={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </AutoSaveField>

      <AutoSaveField
        name="age"
        schema={baseUserSchema}
        initialValue={user.data?.age ?? 0}
        mutationOptions={userMutationOptions}
      >
        {field => (
          <field.Number
            label="Age:"
            required
            value={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </AutoSaveField>
    </Stack>
  );
}

function TanStack() {
  const user = useQuery(userQuery);

  const form = useScrapsForm({
    ...defaultFormOptions,
    formId: 'user-form-example',
    defaultValues: user.data,
    validators: {
      onDynamic: baseUserSchema,
    },
    onSubmit: ({value}) => {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value));
    },
  });

  if (user.isPending) {
    return <div>Loading...</div>;
  }

  return (
    <form.AppForm>
      <form
        onSubmit={e => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.FieldGroup title="Peronal Information">
          <form.AppField name="firstName">
            {field => (
              <field.Input
                label="Firstname:"
                value={field.state.value ?? ''}
                onChange={field.handleChange}
              />
            )}
          </form.AppField>
          <form.AppField name="lastName">
            {field => (
              <field.Input
                label="Lastname:"
                required
                hintText="Your family name"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.AppField>
          <form.AppField name="age">
            {field => (
              <field.Number
                label="Age:"
                required
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.AppField>
          <form.Subscribe selector={state => state.values.age === 42}>
            {showSecret =>
              showSecret ? (
                <form.AppField
                  name="secret"
                  validators={{
                    onDynamic: z.string('Secret is required when age is 42'),
                  }}
                >
                  {field => (
                    <field.Input
                      label="Secret:"
                      required
                      value={field.state.value ?? ''}
                      onChange={field.handleChange}
                    />
                  )}
                </form.AppField>
              ) : null
            }
          </form.Subscribe>
        </form.FieldGroup>

        <form.FieldGroup title="Address Information">
          <form.AppField name="address.street">
            {field => (
              <field.Input
                label="Street:"
                required
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.AppField>
          <form.AppField name="address.city">
            {field => (
              <field.Input
                required
                label="City:"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.AppField>
          <form.AppField name="address.country">
            {field => (
              <field.Select
                required
                label="Country:"
                value={field.state.value}
                onChange={field.handleChange}
                options={COUNTRY_OPTIONS}
              />
            )}
          </form.AppField>
        </form.FieldGroup>

        <Flex gap="md">
          <form.SubmitButton>Submit</form.SubmitButton>
          <Button onClick={() => form.reset()}>Reset</Button>
        </Flex>
      </form>
    </form.AppForm>
  );
}

export default Storybook.story('Form', story => {
  story('TanStackAutoSave', () => {
    return (
      <Fragment>
        <TanStackAutoSave />
      </Fragment>
    );
  });
  story('TanStack', () => {
    return (
      <Fragment>
        <TanStack />
        <TanStackDevtools plugins={[formDevtoolsPlugin()]} />
      </Fragment>
    );
  });
});
