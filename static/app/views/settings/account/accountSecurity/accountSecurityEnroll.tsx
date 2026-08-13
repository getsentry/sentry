import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Authenticator} from 'sentry/types/auth';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {RemoveConfirm} from 'sentry/views/settings/account/accountSecurity/components/removeConfirm';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import {AuthenticatorHeader} from './components/authenticatorHeader';
import {SmsEnrollForm} from './components/smsEnrollForm';
import {TotpEnrollForm} from './components/totpEnrollForm';
import {U2fEnrollForm} from './components/u2fEnrollForm';
import {useAccountSecurityEnrollActions} from './useAccountSecurityEnrollActions';

/**
 * Renders necessary forms in order to enroll user in 2fa
 */
export default function AccountSecurityEnroll() {
  const {authId: interfaceId} = useParams<{authId: string}>();
  const navigate = useNavigate();

  const {
    data: authenticator,
    error,
    isError,
    isPending,
    refetch,
  } = useQuery(
    apiOptions.as<Authenticator>()('/users/$userId/authenticators/$interfaceId/enroll/', {
      path: {userId: 'me', interfaceId},
      staleTime: 0,
    })
  );

  const alreadyEnrolled =
    error instanceof RequestError &&
    error.status === 400 &&
    error.responseJSON?.details === 'Already enrolled';

  const {completeEnrollment, deleteAuthenticator} = useAccountSecurityEnrollActions({
    authenticator,
  });

  useEffect(() => {
    if (!isError) {
      return;
    }

    if (alreadyEnrolled) {
      navigate('/settings/account/security/');
      addErrorMessage(t('Already enrolled'));
    }
  }, [alreadyEnrolled, isError, navigate]);

  if (isPending || alreadyEnrolled) {
    return <LoadingIndicator />;
  }
  if (isError) {
    if (error instanceof RequestError && error.status === 404) {
      return <NotFound />;
    }
    if (error instanceof RequestError && error.status === 403) {
      return (
        <LoadingError message={t('You do not have permission to view this page.')} />
      );
    }
    return <LoadingError message={error.message} onRetry={refetch} />;
  }

  if (!authenticator) {
    return null;
  }

  const isActive = authenticator.isEnrolled || authenticator.status === 'rotation';
  const hasEnrollmentForm = Boolean(authenticator.form?.length);
  const authenticatorId = authenticator.authId;

  return (
    <SentryDocumentTitle title={t('Security')}>
      <SettingsPageHeader
        title={<AuthenticatorHeader name={authenticator.name} isActive={isActive} />}
        action={
          authenticator.isEnrolled &&
          authenticatorId &&
          authenticator.removeButton && (
            <RemoveConfirm onConfirm={() => deleteAuthenticator(authenticatorId)}>
              <Button variant="danger">{authenticator.removeButton}</Button>
            </RemoveConfirm>
          )
        }
      />

      <TextBlock>{authenticator.description}</TextBlock>

      {authenticator.rotationWarning && authenticator.status === 'rotation' && (
        <Alert.Container>
          <Alert variant="warning">{authenticator.rotationWarning}</Alert>
        </Alert.Container>
      )}

      {hasEnrollmentForm && authenticator.id === 'totp' && (
        <TotpEnrollForm
          authenticator={authenticator}
          onEnrollmentComplete={completeEnrollment}
        />
      )}
      {hasEnrollmentForm && authenticator.id === 'sms' && (
        <SmsEnrollForm
          authenticator={authenticator}
          onEnrollmentComplete={completeEnrollment}
          onReset={refetch}
        />
      )}
      {hasEnrollmentForm && authenticator.id === 'u2f' && (
        <U2fEnrollForm
          authenticator={authenticator}
          onEnrollmentComplete={completeEnrollment}
        />
      )}
    </SentryDocumentTitle>
  );
}
