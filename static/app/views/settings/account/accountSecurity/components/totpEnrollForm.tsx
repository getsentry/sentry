import {z} from 'zod';

import {
  defaultFormOptions,
  FieldGroup as FormPanel,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {QuietZoneQRCode} from 'sentry/components/quietZoneQRCode';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import type {TotpAuthenticator} from 'sentry/types/auth';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {useEnrollAuthenticator} from 'sentry/views/settings/account/accountSecurity/useEnrollAuthenticator';

import {getServerFieldDefault, getServerFieldLabel} from './enrollFormFieldUtils';

const OTP_MAX_LENGTH = 20;

interface TotpEnrollFormProps {
  authenticator: TotpAuthenticator;
  onEnrollmentComplete: () => Promise<void>;
}

export function TotpEnrollForm({
  authenticator,
  onEnrollmentComplete,
}: TotpEnrollFormProps): React.ReactElement {
  const {mutateAsync: enrollAuthenticator} = useEnrollAuthenticator(authenticator.id);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {otp: getServerFieldDefault(authenticator.form, 'otp')},
    validators: {
      onDynamic: z.object({
        otp: z.string().min(1, t('Authenticator token is required')).max(OTP_MAX_LENGTH),
      }),
    },
    onSubmit: async ({value}) => {
      if (!authenticator.secret) {
        return;
      }

      try {
        await enrollAuthenticator({...value, secret: authenticator.secret});
      } catch (caughtError) {
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

  return (
    <form.AppForm form={form}>
      <FormPanel title={t('Configuration')}>
        <Flex justify="center">
          <QuietZoneQRCode
            aria-label={t('Enrollment QR Code')}
            value={authenticator.qrcode}
            size={228}
          />
        </Flex>

        <Stack gap="xs">
          <Text bold size="sm">
            {t('Authenticator secret')}
          </Text>
          <TextCopyInput>{authenticator.secret ?? ''}</TextCopyInput>
        </Stack>

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

        <Flex justify="end">
          <form.SubmitButton>{t('Confirm')}</form.SubmitButton>
        </Flex>
      </FormPanel>
    </form.AppForm>
  );
}
