import {Fragment} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {revalidateLogic} from '@tanstack/react-form';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import type {SelectValue} from 'sentry/types/core';

import {defaultFormOptions, useScrapsForm} from './index';

const COUNTRY_OPTIONS = [
  {value: 'US', label: 'United States'},
  {value: 'CA', label: 'Canada'},
  {value: 'AT', label: 'Austria'},
];

const userSchema = z
  .object({
    age: z.number().gte(13, 'You must be 13 to make an account'),
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
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
          {field => {
            return <field.Input label="First Name:" />;
          }}
        </form.AppField>
        <form.AppField name="lastName">
          {field => {
            return <field.Input label="Last Name:" />;
          }}
        </form.AppField>
        <form.AppField name="age">
          {field => {
            return <field.Number label="Age:" />;
          }}
        </form.AppField>
        <form.Subscribe selector={state => state.values.age === 42}>
          {showSecret => {
            return showSecret ? (
              <form.AppField name="secret">
                {field => {
                  return <field.Input label="Secret:" />;
                }}
              </form.AppField>
            ) : null;
          }}
        </form.Subscribe>
        <div style={{marginTop: '20px', marginBottom: '10px'}}>
          <strong>Address</strong>
        </div>
        <form.AppField name="address.street">
          {field => {
            return <field.Input label="Street:" />;
          }}
        </form.AppField>
        <form.AppField name="address.city">
          {field => {
            return <field.Input label="City:" />;
          }}
        </form.AppField>
        <form.AppField name="address.country">
          {field => {
            return <field.Select label="Country:" options={COUNTRY_OPTIONS} />;
          }}
        </form.AppField>
        <form.SubmitButton>Submit</form.SubmitButton>
      </form>
    </form.AppForm>
  );
}

function Rhf() {
  const {
    control,
    handleSubmit,
    watch,
    formState: {isSubmitting},
  } = useForm({
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

  const age = watch('age');
  const showSecret = age === 42;

  return (
    <form
      autoComplete="off"
      onSubmit={handleSubmit(data => {
        // eslint-disable-next-line no-alert
        alert(JSON.stringify(data));
      })}
    >
      <Controller
        name="firstName"
        control={control}
        render={({field, fieldState}) => (
          <Stack as="label" gap="sm">
            <Text>First Name:</Text>
            <Input
              {...field}
              aria-invalid={!!fieldState.error}
              onChange={e => field.onChange(e.target.value)}
            />
            {fieldState.error ? (
              <Text size="sm" variant="danger">
                {fieldState.error.message}
              </Text>
            ) : null}
          </Stack>
        )}
      />
      <Controller
        name="lastName"
        control={control}
        render={({field, fieldState}) => (
          <Stack as="label" gap="sm">
            <Text>Last Name:</Text>
            <Input
              {...field}
              aria-invalid={!!fieldState.error}
              onChange={e => field.onChange(e.target.value)}
            />
            {fieldState.error ? (
              <Text size="sm" variant="danger">
                {fieldState.error.message}
              </Text>
            ) : null}
          </Stack>
        )}
      />
      <Controller
        name="age"
        control={control}
        render={({field, fieldState}) => (
          <Stack as="label" gap="sm">
            <Text>Age:</Text>
            <Input
              {...field}
              type="number"
              aria-invalid={!!fieldState.error}
              onChange={e => field.onChange(Number(e.target.value))}
            />
            {fieldState.error ? (
              <Text size="sm" variant="danger">
                {fieldState.error.message}
              </Text>
            ) : null}
          </Stack>
        )}
      />
      {showSecret ? (
        <Controller
          name="secret"
          control={control}
          render={({field, fieldState}) => (
            <Stack as="label" gap="sm">
              <Text>Secret:</Text>
              <Input
                {...field}
                aria-invalid={!!fieldState.error}
                onChange={e => field.onChange(e.target.value)}
              />
              {fieldState.error ? (
                <Text size="sm" variant="danger">
                  {fieldState.error.message}
                </Text>
              ) : null}
            </Stack>
          )}
        />
      ) : null}
      <div style={{marginTop: '20px', marginBottom: '10px'}}>
        <strong>Address</strong>
      </div>
      <Controller
        name="address.street"
        control={control}
        render={({field, fieldState}) => (
          <Stack as="label" gap="sm">
            <Text>Street:</Text>
            <Input
              {...field}
              aria-invalid={!!fieldState.error}
              onChange={e => field.onChange(e.target.value)}
            />
            {fieldState.error ? (
              <Text size="sm" variant="danger">
                {fieldState.error.message}
              </Text>
            ) : null}
          </Stack>
        )}
      />
      <Controller
        name="address.city"
        control={control}
        render={({field, fieldState}) => (
          <Stack as="label" gap="sm">
            <Text>City:</Text>
            <Input
              {...field}
              aria-invalid={!!fieldState.error}
              onChange={e => field.onChange(e.target.value)}
            />
            {fieldState.error ? (
              <Text size="sm" variant="danger">
                {fieldState.error.message}
              </Text>
            ) : null}
          </Stack>
        )}
      />
      <Controller
        name="address.country"
        control={control}
        render={({field, fieldState}) => (
          <Stack as="label" gap="sm">
            <Text>Country:</Text>
            <Select
              {...field}
              aria-invalid={!!fieldState.error}
              options={COUNTRY_OPTIONS}
              onChange={(option: SelectValue<string>) =>
                field.onChange(option?.value ?? '')
              }
            />
            {fieldState.error ? (
              <Text size="sm" variant="danger">
                {fieldState.error.message}
              </Text>
            ) : null}
          </Stack>
        )}
      />
      <Button type="submit" disabled={isSubmitting}>
        Submit
      </Button>
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
