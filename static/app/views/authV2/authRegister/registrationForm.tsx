import {Fragment, useState, type ReactNode} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {PasswordStrengthIndicator} from 'sentry/components/passwordStrengthIndicator';
import {IconHide} from 'sentry/icons/iconHide';
import {IconShow} from 'sentry/icons/iconShow';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import type {AuthenticatedResult} from 'sentry/views/authV2/authLogin/types';

const schema = z.object({
  email: z.email(t('Enter a valid email address')),
  name: z.string().trim().min(1, t('Enter your name')),
  password: z.string().min(1, t('Enter a password')),
  subscribe: z.boolean(),
});

type RegistrationValues = z.infer<typeof schema>;

type Props = {
  hasNewsletter: boolean;
  initialEmail?: string;
  onSuccess?: (result: AuthenticatedResult) => void;
  secondaryAction?: ReactNode;
};

export function RegistrationForm({
  hasNewsletter,
  initialEmail = '',
  onSuccess,
  secondaryAction,
}: Props) {
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const mutation = useMutation({
    mutationFn: (value: RegistrationValues) =>
      fetchMutation<AuthenticatedResult>({
        url: getApiUrl('/auth/register/'),
        method: 'POST',
        data: {
          email: value.email,
          name: value.name,
          password: value.password,
          ...(hasNewsletter ? {subscribe: value.subscribe} : {}),
        },
      }),
    onSuccess: result =>
      onSuccess ? onSuccess(result) : testableWindowLocation.assign(result.nextUri),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {email: initialEmail, name: '', password: '', subscribe: false},
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) =>
      mutation.mutateAsync(schema.parse(value)).catch((error: unknown) => {
        if (error instanceof RequestError) {
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values));
        }
      }),
  });

  return (
    <Stack width="100%" gap="2xl">
      <form.AppForm form={form}>
        <Stack gap="lg">
          {mutation.error && (
            <Alert role="alert" variant="danger">
              {getRequestErrorUserMessage(
                mutation.error,
                t('Unable to create your account. Try again.')
              )}
            </Alert>
          )}
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack label={t('Name')} required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  autoComplete="name"
                  placeholder={t('John Doe')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="email">
            {field => (
              <field.Layout.Stack label={t('Email')} required>
                <field.Input
                  type="email"
                  value={field.state.value}
                  onChange={field.handleChange}
                  autoComplete="email"
                  placeholder={t('john@buggy.software')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="password">
            {field => (
              <field.Layout.Stack label={t('Password')} required>
                <field.Input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={field.state.value}
                  onChange={field.handleChange}
                  autoComplete="new-password"
                  trailingItems={
                    <Fragment>
                      <PasswordStrengthIndicator value={field.state.value} />
                      <Button
                        size="xs"
                        variant="transparent"
                        icon={
                          isPasswordVisible ? (
                            <IconShow size="xs" />
                          ) : (
                            <IconHide size="xs" />
                          )
                        }
                        aria-label={
                          isPasswordVisible ? t('Hide password') : t('Show password')
                        }
                        onClick={() => setPasswordVisible(visible => !visible)}
                      />
                    </Fragment>
                  }
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          {hasNewsletter && (
            <form.AppField name="subscribe">
              {field => (
                <field.Checkbox
                  checked={field.state.value}
                  onChange={field.handleChange}
                  label={t('Send me the Sentry newsletter')}
                  hintText={t(
                    'Get product updates, educational content, and event news by email.'
                  )}
                />
              )}
            </form.AppField>
          )}
        </Stack>
      </form.AppForm>
      <Flex align="center" justify={secondaryAction ? 'between' : 'end'} gap="md">
        {secondaryAction}
        <form.Subscribe
          selector={state =>
            !state.isSubmitting && schema.safeParse(state.values).success
          }
        >
          {canSubmit => (
            <Button
              variant="primary"
              type="submit"
              form={form.formId}
              busy={mutation.isPending}
              disabled={!canSubmit}
            >
              {t('Create account')}
            </Button>
          )}
        </form.Subscribe>
      </Flex>
    </Stack>
  );
}
