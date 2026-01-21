import {Fragment, useEffect} from 'react';
import {useForm, useWatch, type Control} from 'react-hook-form';
import {
  Form as FormischForm,
  reset,
  useField as useFormischField,
  useForm as useFormischForm,
  type FormStore,
} from '@formisch/react';
import {zodResolver} from '@hookform/resolvers/zod';
import {TanStackDevtools} from '@tanstack/react-devtools';
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools';
import {
  mutationOptions,
  queryOptions,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import * as v from 'valibot';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {Stack} from 'sentry/components/core/layout/stack';
import * as Storybook from 'sentry/stories';

import {autoSaveOptions} from './autoSaveField';
import {
  FormischField,
  InputField as FormischInputField,
  NumberField as FormischNumberField,
  SelectField as FormischSelectField,
  SubmitButton as FormischSubmitButton,
} from './index.formisch';
import {InputField, NumberField, RHFField, SelectField, SubmitButton} from './index.rhf';
import {defaultFormOptions, useScrapsForm} from './index.tanstack';

const COUNTRY_OPTIONS = [
  {value: 'US', label: 'United States'},
  {value: 'CA', label: 'Canada'},
  {value: 'AT', label: 'Austria'},
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const baseUserSchema = z.object({
  age: z.number().gte(13, 'You must be 13 to make an account'),
  firstName: z.string(),
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

// Valibot schema for Formisch
const userSchemaValibot = v.pipe(
  v.object({
    age: v.pipe(v.number(), v.minValue(13, 'You must be 13 to make an account')),
    firstName: v.string(),
    lastName: v.pipe(
      v.string(),
      v.minLength(2, 'Last name must be at least 2 characters')
    ),
    secret: v.string(),
    address: v.object({
      street: v.pipe(v.string(), v.minLength(1, 'Street is required')),
      city: v.pipe(v.string(), v.minLength(1, 'City is required')),
      country: v.pipe(v.string(), v.minLength(1, 'Country is required')),
    }),
  }),
  v.check(input => {
    if (input.age === 42) {
      return input.secret.length > 0;
    }
    return true;
  }, 'Secret is required when age is 42')
);

// type SubmitMeta = {
//   name: keyof z.infer<typeof baseUserSchema> | undefined;
// };
// const submitMeta: SubmitMeta = {
//   name: undefined,
// };

type User = z.infer<typeof baseUserSchema>;

const userMutationOptions = mutationOptions({
  mutationFn: async (variables: Partial<User>) => {
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

  const updateFirstName = useMutation(userMutationOptions);
  const updateLastName = useMutation(userMutationOptions);
  const updateAge = useMutation(userMutationOptions);

  const firstNameForm = useScrapsForm({
    ...autoSaveOptions({
      schema: baseUserSchema,
      name: 'firstName',
      initialValue: user.data?.firstName ?? '',
    }),
    onSubmit: ({value}) => updateFirstName.mutateAsync(value),
  });

  const lastNameForm = useScrapsForm({
    ...autoSaveOptions({
      schema: baseUserSchema,
      name: 'lastName',
      initialValue: user.data?.lastName ?? '',
    }),
    onSubmit: ({value}) => updateLastName.mutateAsync(value),
  });

  const ageForm = useScrapsForm({
    ...autoSaveOptions({
      schema: baseUserSchema,
      name: 'age',
      initialValue: user.data?.age ?? 0,
    }),
    onSubmit: ({value}) => updateAge.mutateAsync(value),
  });

  if (user.isPending) {
    return <div>Loading...</div>;
  }

  return (
    <Stack gap="lg">
      <firstNameForm.AppField name="firstName">
        {field => (
          <field.Input
            autoComplete="off"
            data-1p-disabled="true"
            label="First Name:"
            disabled={updateFirstName.isPending}
            value={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </firstNameForm.AppField>

      <lastNameForm.AppField name="lastName">
        {field => (
          <field.Input
            autoComplete="off"
            data-1p-disabled="true"
            label="Last Name:"
            disabled={updateLastName.isPending}
            required
            value={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </lastNameForm.AppField>

      <ageForm.AppField name="age">
        {field => (
          <field.Number
            autoComplete="off"
            data-1p-disabled="true"
            label="Age:"
            disabled={updateAge.isPending}
            required
            value={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </ageForm.AppField>
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
        autoComplete="off"
        onSubmit={e => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack gap="lg">
          <form.AppField name="firstName">
            {field => (
              <field.Input
                label="First Name:"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.AppField>
          <form.AppField name="lastName">
            {field => (
              <field.Input
                label="Last Name:"
                required
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
          <div style={{marginTop: '20px', marginBottom: '10px'}}>
            <strong>Address</strong>
          </div>
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

          <Flex gap="md">
            <form.SubmitButton>Submit</form.SubmitButton>
            <Button onClick={() => form.reset()}>Reset</Button>
          </Flex>
        </Stack>
      </form>
    </form.AppForm>
  );
}

type UserFormValues = z.infer<typeof userSchema>;

function RHFSecretField({control}: {control: Control<UserFormValues>}) {
  // Subscribe to just the age field reactively - only this component re-renders when age changes
  const age = useWatch({control, name: 'age'});
  const showSecret = age === 42;

  if (!showSecret) {
    return null;
  }

  return (
    <RHFField name="secret" control={control}>
      {field => (
        <InputField
          required
          label="Secret:"
          value={field.value ?? ''}
          onChange={field.onChange}
          ref={field.ref}
        />
      )}
    </RHFField>
  );
}

function Rhf() {
  const user = useQuery(userQuery);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    values: user.data,
  });

  if (user.isPending) {
    return <div>Loading...</div>;
  }

  return (
    <form
      autoComplete="off"
      onSubmit={form.handleSubmit(data => {
        // eslint-disable-next-line no-alert
        alert(JSON.stringify(data));
      })}
    >
      <Stack gap="lg">
        <RHFField name="firstName" control={form.control}>
          {field => (
            <InputField
              label="First Name:"
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
            />
          )}
        </RHFField>
        <RHFField name="lastName" control={form.control}>
          {field => (
            <InputField
              label="Last Name:"
              required
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
            />
          )}
        </RHFField>
        <RHFField name="age" control={form.control}>
          {field => (
            <NumberField
              label="Age:"
              required
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
            />
          )}
        </RHFField>
        <RHFSecretField control={form.control} />
        <div style={{marginTop: '20px', marginBottom: '10px'}}>
          <strong>Address</strong>
        </div>
        <RHFField name="address.street" control={form.control}>
          {field => (
            <InputField
              label="Street:"
              required
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
            />
          )}
        </RHFField>
        <RHFField name="address.city" control={form.control}>
          {field => (
            <InputField
              label="City:"
              required
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
            />
          )}
        </RHFField>
        <RHFField name="address.country" control={form.control}>
          {field => (
            <SelectField
              label="Country:"
              required
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
              options={COUNTRY_OPTIONS}
            />
          )}
        </RHFField>
        <Flex gap="md">
          <SubmitButton isSubmitting={form.formState.isSubmitting}>Submit</SubmitButton>
          <Button onClick={() => form.reset()}>Reset</Button>
        </Flex>
      </Stack>
    </form>
  );
}

function FormischSecretField({form}: {form: FormStore<typeof userSchemaValibot>}) {
  // Subscribe to just the age field reactively - only this component re-renders when age changes
  const ageField = useFormischField(form, {path: ['age']});
  const showSecret = ageField.input === 42;

  if (!showSecret) {
    return null;
  }

  return (
    <FormischField of={form} path={['secret']}>
      {field => (
        <FormischInputField
          label="Secret:"
          required
          value={field.value}
          onChange={field.onChange}
        />
      )}
    </FormischField>
  );
}

function Formisch() {
  const user = useQuery(userQuery);
  const form = useFormischForm({
    schema: userSchemaValibot,
    initialInput: {
      age: 0,
      firstName: '',
      lastName: '',
      secret: '',
      address: {
        street: '',
        city: '',
        country: '',
      },
    },
  });

  useEffect(() => {
    if (user.data) {
      reset(form, {initialInput: user.data});
    }
  }, [user.data, form]);

  if (user.isPending) {
    return <div>Loading...</div>;
  }

  return (
    <FormischForm
      of={form}
      onSubmit={output => {
        // eslint-disable-next-line no-alert
        alert(JSON.stringify(output));
      }}
    >
      <Stack gap="lg">
        <FormischField of={form} path={['firstName']}>
          {field => (
            <FormischInputField
              label="First Name:"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        </FormischField>
        <FormischField of={form} path={['lastName']}>
          {field => (
            <FormischInputField
              label="Last Name:"
              required
              value={field.value}
              onChange={field.onChange}
            />
          )}
        </FormischField>
        <FormischField of={form} path={['age']}>
          {field => (
            <FormischNumberField
              label="Age:"
              required
              value={field.value}
              onChange={field.onChange}
            />
          )}
        </FormischField>
        <FormischSecretField form={form} />
        <div style={{marginTop: '20px', marginBottom: '10px'}}>
          <strong>Address</strong>
        </div>
        <FormischField of={form} path={['address', 'street']}>
          {field => (
            <FormischInputField
              label="Street:"
              required
              value={field.value}
              onChange={field.onChange}
            />
          )}
        </FormischField>
        <FormischField of={form} path={['address', 'city']}>
          {field => (
            <FormischInputField
              label="City:"
              required
              value={field.value}
              onChange={field.onChange}
            />
          )}
        </FormischField>
        <FormischField of={form} path={['address', 'country']}>
          {field => (
            <FormischSelectField
              label="Country:"
              required
              value={field.value}
              onChange={field.onChange}
              options={COUNTRY_OPTIONS}
            />
          )}
        </FormischField>
        <Flex gap="md">
          <FormischSubmitButton isSubmitting={form.isSubmitting}>
            Submit
          </FormischSubmitButton>
          <Button onClick={() => reset(form)}>Reset</Button>
        </Flex>
      </Stack>
    </FormischForm>
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
      </Fragment>
    );
  });

  story('RHF', () => {
    return (
      <Fragment>
        <Rhf />
      </Fragment>
    );
  });

  story('Formisch', () => {
    return (
      <Fragment>
        <Formisch />
        <TanStackDevtools plugins={[formDevtoolsPlugin()]} />
      </Fragment>
    );
  });
});
