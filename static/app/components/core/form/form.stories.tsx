import {Fragment} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {revalidateLogic} from '@tanstack/react-form';
import {z} from 'zod';

import * as Storybook from 'sentry/stories';

import {defaultFormOptions, useScrapsForm} from './index';
import {InputField, NumberField, SelectField, SubmitButton} from './index.rhf';

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
      </form>
    </form.AppForm>
  );
}

type UserFormValues = z.infer<typeof userSchema>;

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

  const age = form.watch('age');
  const showSecret = age === 42;

  return (
    <form
      autoComplete="off"
      onSubmit={form.handleSubmit(data => {
        // eslint-disable-next-line no-alert
        alert(JSON.stringify(data));
      })}
    >
      <Controller
        name="firstName"
        control={form.control}
        render={({field, fieldState}) => (
          <InputField
            label="First Name:"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={!!fieldState.error}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="lastName"
        control={form.control}
        render={({field, fieldState}) => (
          <InputField
            label="Last Name:"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={!!fieldState.error}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="age"
        control={form.control}
        render={({field, fieldState}) => (
          <NumberField
            label="Age:"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={!!fieldState.error}
            error={fieldState.error?.message}
          />
        )}
      />
      {showSecret ? (
        <Controller
          name="secret"
          control={form.control}
          render={({field, fieldState}) => (
            <InputField
              label="Secret:"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={!!fieldState.error}
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}
      <div style={{marginTop: '20px', marginBottom: '10px'}}>
        <strong>Address</strong>
      </div>
      <Controller
        name="address.street"
        control={form.control}
        render={({field, fieldState}) => (
          <InputField
            label="Street:"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={!!fieldState.error}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="address.city"
        control={form.control}
        render={({field, fieldState}) => (
          <InputField
            label="City:"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={!!fieldState.error}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="address.country"
        control={form.control}
        render={({field, fieldState}) => (
          <SelectField
            label="Country:"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            options={COUNTRY_OPTIONS}
            aria-invalid={!!fieldState.error}
            error={fieldState.error?.message}
          />
        )}
      />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>Submit</SubmitButton>
    </form>
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
});
