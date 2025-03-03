import {Fragment, useState} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Authenticator} from 'sentry/types/auth';
import {useApiQuery} from 'sentry/utils/queryClient';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = ModalRenderProps & {
  authenticatorName: string;
};

function RecoveryOptionsModal({
  authenticatorName,
  closeModal,
  Body,
  Header,
  Footer,
}: Props) {
  const {
    isPending,
    isError,
    refetch: refetchAuthenticators,
    data: authenticators = [],
  } = useApiQuery<Authenticator[]>(['/users/me/authenticators/'], {
    staleTime: 5000, // expire after 5 seconds
  });
  const [skipSms, setSkipSms] = useState<boolean>(false);

  const {recovery, sms} = authenticators.reduce<{[key: string]: Authenticator}>(
    (obj, item) => {
      obj[item.id] = item;
      return obj;
    },
    {}
  );

  const recoveryEnrolled = recovery?.isEnrolled;
  const displaySmsPrompt =
    sms && !sms.isEnrolled && !skipSms && !sms.disallowNewEnrollment;

  const handleSkipSms = () => {
    setSkipSms(true);
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t('There was an error loading authenticators.')}
        onRetry={refetchAuthenticators}
      />
    );
  }

  return (
    <Fragment>
      <Header closeButton>{t('Two-Factor Authentication Enabled')}</Header>

      <Body>
        <TextBlock>
          {t('Two-factor authentication via %s has been enabled.', authenticatorName)}
        </TextBlock>
        <TextBlock>
          {t('You should now set up recovery options to secure your account.')}
        </TextBlock>

        {displaySmsPrompt ? (
          // set up backup phone number
          <Alert.Container>
            <Alert type="warning">
              {t('We recommend adding a phone number as a backup 2FA method.')}
            </Alert>
          </Alert.Container>
        ) : (
          // get recovery codes
          <Alert.Container>
            <Alert type="warning">
              {t(
                `Recovery codes are the only way to access your account if you lose
                  your device and cannot receive two-factor authentication codes.`
              )}
            </Alert>
          </Alert.Container>
        )}
      </Body>

      {displaySmsPrompt ? (
        // set up backup phone number
        <Footer>
          <Button onClick={handleSkipSms} name="skipStep" autoFocus>
            {t('Skip this step')}
          </Button>
          <LinkButton
            priority="primary"
            onClick={closeModal}
            to={`/settings/account/security/mfa/${sms.id}/enroll/`}
            name="addPhone"
            css={css`
              margin-left: ${space(1)};
            `}
            autoFocus
          >
            {t('Add a Phone Number')}
          </LinkButton>
        </Footer>
      ) : (
        // get recovery codes
        <Footer>
          <LinkButton
            priority="primary"
            onClick={closeModal}
            to={
              recoveryEnrolled
                ? `/settings/account/security/mfa/${recovery.authId}/`
                : '/settings/account/security/'
            }
            name="getCodes"
            autoFocus
          >
            {t('Get Recovery Codes')}
          </LinkButton>
        </Footer>
      )}
    </Fragment>
  );
}

export default RecoveryOptionsModal;
