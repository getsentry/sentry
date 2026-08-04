import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  defaultFormOptions,
  FieldGroup as FormPanel,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {handleEnroll} from 'sentry/components/webAuthn/handlers';
import {t} from 'sentry/locale';
import type {U2fAuthenticator} from 'sentry/types/auth';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useEnrollAuthenticator} from 'sentry/views/settings/account/accountSecurity/useEnrollAuthenticator';

import {getServerFieldDefault, getServerFieldLabel} from './enrollFormFieldUtils';

const ENROLLMENT_FAILURE_MESSAGE = t('There was a problem enrolling, please try again.');

interface U2fEnrollFormProps {
  authenticator: U2fAuthenticator;
  onEnrollmentComplete: () => Promise<void>;
}

interface WebAuthnFieldErrors {
  deviceName?: {message: string};
  enrollment?: {message: string};
}

interface WebAuthnEnrollment {
  challenge: string;
  response: string;
}

function getApiFieldError(responseJSON: unknown, fieldName: string): string | undefined {
  const response = Array.isArray(responseJSON) ? responseJSON[0] : responseJSON;
  if (!response || typeof response !== 'object' || !(fieldName in response)) {
    return undefined;
  }

  const fieldError = response[fieldName as keyof typeof response];
  if (typeof fieldError === 'string') {
    return fieldError;
  }
  if (Array.isArray(fieldError) && typeof fieldError[0] === 'string') {
    return fieldError[0];
  }
  return undefined;
}

function getWebAuthnFieldErrors(responseJSON: unknown): WebAuthnFieldErrors {
  const enrollmentError =
    getApiFieldError(responseJSON, 'challenge') ??
    getApiFieldError(responseJSON, 'response');
  const deviceNameError = getApiFieldError(responseJSON, 'deviceName');
  const fieldErrors: WebAuthnFieldErrors = {};

  if (enrollmentError) {
    fieldErrors.enrollment = {message: enrollmentError};
  }
  if (deviceNameError) {
    fieldErrors.deviceName = {message: deviceNameError};
  }
  return fieldErrors;
}

export function U2fEnrollForm({
  authenticator,
  onEnrollmentComplete,
}: U2fEnrollFormProps): React.ReactElement {
  const {mutateAsync: enrollAuthenticator} = useEnrollAuthenticator(authenticator.id);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      deviceName: getServerFieldDefault(authenticator.form, 'deviceName'),
      enrollment: {challenge: '', response: ''},
    },
    validators: {
      onDynamic: z.object({
        deviceName: z.string().max(60, t('Device name must be 60 characters or fewer.')),
        enrollment: z
          .object({
            challenge: z.string(),
            response: z.string(),
          })
          .refine(value => Boolean(value.challenge), {
            message: t('Enroll your device before continuing.'),
          }),
      }),
    },
    onSubmit: async ({value, formApi}) => {
      try {
        await enrollAuthenticator({
          ...value.enrollment,
          deviceName: value.deviceName,
        });
      } catch (caughtError) {
        if (caughtError instanceof RequestError) {
          const fieldErrors = getWebAuthnFieldErrors(caughtError.responseJSON);
          if (Object.keys(fieldErrors).length > 0) {
            if (fieldErrors.enrollment) {
              formApi.setFieldValue('enrollment', {challenge: '', response: ''});
            }
            setFieldErrors(formApi, fieldErrors);
            return;
          }
        }

        addErrorMessage(
          getRequestErrorUserMessage(
            caughtError,
            t('Could not add the %s authenticator. Try again.', authenticator.name)
          )
        );
        return;
      }

      await onEnrollmentComplete();
    },
  });

  async function triggerEnroll(
    handleChange: (value: WebAuthnEnrollment) => void
  ): Promise<void> {
    try {
      const webAuthnResponse = await handleEnroll(authenticator.challenge);
      if (!webAuthnResponse) {
        addErrorMessage(ENROLLMENT_FAILURE_MESSAGE);
        return;
      }

      handleChange({
        challenge: JSON.stringify(authenticator.challenge),
        response: webAuthnResponse,
      });
    } catch {
      addErrorMessage(ENROLLMENT_FAILURE_MESSAGE);
    }
  }

  const isWebAuthnSupported = Boolean(window.PublicKeyCredential);

  return (
    <form.AppForm form={form}>
      <FormPanel title={t('Configuration')}>
        <form.AppField name="enrollment">
          {field => (
            <field.Layout.Row
              label={t('Enroll Device')}
              hintText={t(
                'Enroll your Passkey, Security Key, or Biometric authenticator.'
              )}
              required
            >
              <Flex align="center" justify="end" gap="sm">
                <Stack gap="sm" align="end">
                  <Button
                    type="button"
                    onClick={() => triggerEnroll(field.handleChange)}
                    disabled={
                      !isWebAuthnSupported || Boolean(field.state.value.challenge)
                    }
                  >
                    {field.state.value.challenge ? t('Enrolled!') : t('Start Enrollment')}
                  </Button>
                  {!isWebAuthnSupported && (
                    <Text variant="danger" size="sm">
                      {t(
                        'Your browser does not support WebAuthn (passkey). You need to use a different two-factor method or switch to a browser that supports it (Google Chrome or Microsoft Edge)'
                      )}
                    </Text>
                  )}
                </Stack>
                <field.Meta.Status />
              </Flex>
            </field.Layout.Row>
          )}
        </form.AppField>

        <form.AppField name="deviceName">
          {field => (
            <field.Layout.Row
              label={getServerFieldLabel(authenticator.form, 'deviceName')}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                autoComplete="off"
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        <Flex justify="end">
          <form.SubmitButton>{t('Confirm')}</form.SubmitButton>
        </Flex>
      </FormPanel>
    </form.AppForm>
  );
}
