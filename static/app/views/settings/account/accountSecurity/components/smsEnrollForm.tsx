import {useMemo} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  defaultFormOptions,
  FieldGroup as FormPanel,
  useScrapsForm,
  useStore,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {SmsAuthenticator} from 'sentry/types/auth';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {useEnrollAuthenticator} from 'sentry/views/settings/account/accountSecurity/useEnrollAuthenticator';

import {getServerFieldDefault, getServerFieldLabel} from './enrollFormFieldUtils';

const OTP_MAX_LENGTH = 20;
const PHONE_MAX_LENGTH = 20;

interface SmsEnrollFormProps {
  authenticator: SmsAuthenticator;
  onEnrollmentComplete: () => Promise<void>;
  onReset: () => void;
}

export function SmsEnrollForm({
  authenticator,
  onEnrollmentComplete,
  onReset,
}: SmsEnrollFormProps): React.ReactElement {
  const enrollMutation = useEnrollAuthenticator(authenticator.id);
  const isCodeSent =
    enrollMutation.status === 'success' ||
    (enrollMutation.variables !== undefined &&
      'otp' in enrollMutation.variables &&
      enrollMutation.variables.otp !== undefined);

  const schema = useMemo(
    () =>
      z.object({
        phone: z.string().min(1, t('Phone number is required')).max(PHONE_MAX_LENGTH),
        otp: isCodeSent
          ? z.string().min(1, t('Authenticator code is required')).max(OTP_MAX_LENGTH)
          : z.string().max(OTP_MAX_LENGTH),
      }),
    [isCodeSent]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      phone: authenticator.phone ?? getServerFieldDefault(authenticator.form, 'phone'),
      otp: getServerFieldDefault(authenticator.form, 'otp'),
    },
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
      if (!value.phone || !authenticator.secret) {
        return;
      }

      addLoadingMessage(
        isCodeSent ? t('Verifying OTP...') : t('Sending code to %s...', value.phone)
      );

      try {
        await enrollMutation.mutateAsync({
          phone: value.phone,
          otp: isCodeSent ? value.otp : undefined,
          secret: authenticator.secret,
        });
      } catch (caughtError) {
        addErrorMessage(
          getRequestErrorUserMessage(
            caughtError,
            isCodeSent
              ? t('The authenticator code is incorrect. Try again.')
              : t('Could not send the SMS code. Try again.')
          )
        );
        if (!isCodeSent) {
          enrollMutation.reset();
          onReset();
          formApi.reset();
        }
        return;
      }

      if (isCodeSent) {
        await onEnrollmentComplete();
        return;
      }

      addSuccessMessage(t('Sent code to %s', value.phone));
    },
  });
  const isSubmitting = useStore(form.store, state => state.isSubmitting);

  function resetEnrollment(): void {
    enrollMutation.reset();
    onReset();
  }

  return (
    <form.AppForm form={form}>
      <FormPanel title={t('Configuration')}>
        <form.AppField name="phone">
          {field => (
            <field.Layout.Row
              label={getServerFieldLabel(authenticator.form, 'phone')}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                disabled={isSubmitting || isCodeSent}
                autoComplete="off"
                maxLength={PHONE_MAX_LENGTH}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        {isCodeSent && (
          <form.AppField name="otp">
            {field => (
              <field.Layout.Row
                label={getServerFieldLabel(authenticator.form, 'otp')}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  autoComplete="off"
                  maxLength={OTP_MAX_LENGTH}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        )}

        <Flex justify="end" align="center" gap="md">
          {isCodeSent && (
            <Button onClick={resetEnrollment} disabled={isSubmitting}>
              {t('Start Over')}
            </Button>
          )}
          <form.SubmitButton>
            {isCodeSent ? t('Confirm') : t('Send Code')}
          </form.SubmitButton>
        </Flex>
      </FormPanel>
    </form.AppForm>
  );
}
