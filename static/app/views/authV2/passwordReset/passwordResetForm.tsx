import {Fragment, useState} from 'react';
import {IconArrow} from '@sentry/icons/arrow';
import {IconHide} from '@sentry/icons/hide';
import {IconShow} from '@sentry/icons/show';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {PasswordStrengthIndicator} from 'sentry/components/passwordStrengthIndicator';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

const schema = z.object({
  password: z
    .string()
    .min(1, t('Enter a new password'))
    .max(256, t('Use a password with at most 256 characters')),
});

interface Props {
  onInvalidToken: () => void;
  onSuccess: () => void;
  token: string;
  userId: string;
}

export function PasswordResetForm({userId, token, onSuccess, onInvalidToken}: Props) {
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof schema>) =>
      fetchMutation<void>({
        url: getApiUrl('/auth/recovery/confirm/'),
        method: 'POST',
        data: {userId, token, password: value.password},
      }),
    onSuccess,
    onError: error => {
      if (
        error instanceof RequestError &&
        error.status === 400 &&
        error.responseJSON?.detail === 'Invalid or expired recovery token'
      ) {
        onInvalidToken();
      }
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {password: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) => {
      setSubmitError(undefined);
      return mutation.mutateAsync(schema.parse(value)).catch((error: unknown) => {
        if (
          error instanceof RequestError &&
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values))
        ) {
          return;
        }

        setSubmitError(
          getRequestErrorUserMessage(
            error,
            t('Unable to reset your password. Try again.')
          )
        );
      });
    },
  });

  return (
    <form.AppForm form={form}>
      <Stack gap="2xl">
        <Stack gap="lg">
          {submitError && (
            <Alert role="alert" variant="danger">
              {submitError}
            </Alert>
          )}
          <form.AppField name="password">
            {field => (
              <field.Layout.Stack label={t('New password')} required>
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
        </Stack>
        <Flex justify="between" align="center" gap="md">
          <LinkButton
            to="/auth/login/"
            size="xs"
            variant="transparent"
            icon={<IconArrow direction="left" />}
          >
            {t('Back to sign in')}
          </LinkButton>
          <form.SubmitButton variant="primary">{t('Reset password')}</form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}
