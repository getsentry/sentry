import {Fragment, useEffect} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useAuthConfig} from 'sentry/views/authV2/authLogin/hooks/useAuthConfig';
import {useBrandedAuthLoading} from 'sentry/views/authV2/useBrandedAuthLoading';

import {RegistrationForm} from './registrationForm';

export default function AuthRegister() {
  const {termsUrl, privacyUrl} = useLegacyStore(ConfigStore);
  const {
    data: authConfig,
    isPending: isAuthConfigPending,
    error: authConfigError,
  } = useAuthConfig();
  useBrandedAuthLoading(isAuthConfigPending);

  const loginConfig = authConfig && !('nextUri' in authConfig) ? authConfig : null;
  const nextUri = authConfig && 'nextUri' in authConfig ? authConfig.nextUri : null;
  useEffect(() => {
    if (nextUri) {
      testableWindowLocation.assign(nextUri);
    }
  }, [nextUri]);
  if (isAuthConfigPending) {
    return null;
  }

  if (nextUri) {
    return null;
  }

  const canRegister = loginConfig?.canRegister;

  return (
    <Fragment>
      <Stack width="100%" maxWidth="360px" gap="2xl">
        <Heading as="h1" size="3xl" align="center">
          {t('Create your Account')}
        </Heading>

        {authConfigError ? (
          <Alert variant="danger">{t('Unable to load registration. Try again.')}</Alert>
        ) : canRegister ? (
          <RegistrationForm
            hasNewsletter={loginConfig.hasNewsletter}
            secondaryAction={
              <Text as="div" size="sm">
                {tct('Already have an account? [login:Sign in]', {
                  login: <Link to="/auth/login/" />,
                })}
              </Text>
            }
          />
        ) : (
          <Alert variant="warning">{t('Registration is unavailable.')}</Alert>
        )}

        {(termsUrl || privacyUrl) && (
          <Flex justify="center" gap="md" wrap="wrap">
            {termsUrl && (
              <ExternalLink href={termsUrl}>{t('Terms of Service')}</ExternalLink>
            )}
            {privacyUrl && (
              <ExternalLink href={privacyUrl}>{t('Privacy Policy')}</ExternalLink>
            )}
          </Flex>
        )}
      </Stack>
    </Fragment>
  );
}
