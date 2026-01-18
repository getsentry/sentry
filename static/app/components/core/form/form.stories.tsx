import {Fragment} from 'react';
import {useForm, useWatch, type Control} from 'react-hook-form';
import {
  Form as FormischForm,
  useField as useFormischField,
  useForm as useFormischForm,
  type FormStore,
} from '@formisch/react';
import {zodResolver} from '@hookform/resolvers/zod';
import {revalidateLogic} from '@tanstack/react-form';
import * as v from 'valibot';
import {z} from 'zod';

import {Stack} from 'sentry/components/core/layout/stack';
import * as Storybook from 'sentry/stories';

import {defaultFormOptions, useScrapsForm} from './index';
import {
  FormischField,
  InputField as FormischInputField,
  NumberField as FormischNumberField,
  SelectField as FormischSelectField,
  SubmitButton as FormischSubmitButton,
} from './index.formisch';
import {InputField, NumberField, RHFField, SelectField, SubmitButton} from './index.rhf';

const COUNTRY_OPTIONS = [
  {value: 'US', label: 'United States'},
  {value: 'CA', label: 'Canada'},
  {value: 'AT', label: 'Austria'},
];

const userSchema = z
  .object({
    age: z.number().gte(13, 'You must be 13 to make an account'),
    firstName: z.string(),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    secret: z.string(),
    address: z.object({
      street: z.string().min(1, 'Street is required'),
      city: z.string().min(1, 'City is required'),
      country: z.string().min(1, 'Country is required'),
    }),
  })
  .refine(
    data => {
      if (data.age === 42) {
        return data.secret.length > 0;
      }
      return true;
    },
    {
      message: 'Secret is required when age is 42',
      path: ['secret'],
    }
  );

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

function TanStack() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
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
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'blur',
    }),
    validators: {
      onDynamic: userSchema,
    },
    onSubmit: ({value}) => {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(value));
    },
  });

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
                <form.AppField name="secret">
                  {field => (
                    <field.Input
                      label="Secret:"
                      required
                      value={field.state.value}
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
          <form.SubmitButton>Submit</form.SubmitButton>
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
          value={field.value}
          onChange={field.onChange}
        />
      )}
    </RHFField>
  );
}

function Rhf() {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
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
              options={COUNTRY_OPTIONS}
            />
          )}
        </RHFField>
        <SubmitButton isSubmitting={form.formState.isSubmitting}>Submit</SubmitButton>
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
        <FormischSubmitButton isSubmitting={form.isSubmitting}>
          Submit
        </FormischSubmitButton>
      </Stack>
    </FormischForm>
  );
}

export default Storybook.story('Form', story => {
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
      </Fragment>
    );
  });
});
