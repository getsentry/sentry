import {useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {usePasswordReset} from 'sentry/views/authV2/authLogin/hooks/usePasswordReset';

export default function PasswordRecovery() {
  const location = useLocation();
  const [email, setEmail] = useState(
    typeof location.query.email === 'string' ? location.query.email : ''
  );
  const recovery = usePasswordReset();
  const confirmation =
    recovery.result?.message ??
    (location.query.sent === '1'
      ? t('If an eligible account exists, a recovery email has been sent.')
      : null);

  return (
    <Stack width="100%" maxWidth="360px" gap="xl">
      <SentryDocumentTitle title={t('Reset password')} />
      <Heading as="h1" size="3xl" align="center">
        {t('Reset password')}
      </Heading>
      {confirmation ? (
        <Text as="p">{confirmation}</Text>
      ) : (
        <form
          onSubmit={event => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get('email');
            if (typeof value === 'string') {
              recovery.requestPasswordReset(value);
            }
          }}
        >
          <Stack gap="lg">
            {recovery.errorMessage && (
              <Alert role="alert" variant="danger">
                {recovery.errorMessage}
              </Alert>
            )}
            <Stack gap="sm">
              <Text as="label" htmlFor="recovery-email">
                {t('Email')}
              </Text>
              <Input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={event => {
                  setEmail(event.currentTarget.value);
                  recovery.reset();
                }}
              />
            </Stack>
            <Button
              type="submit"
              variant="primary"
              busy={recovery.isPending}
              disabled={recovery.isPending}
            >
              {t('Send recovery email')}
            </Button>
          </Stack>
        </form>
      )}
      <LinkButton to="/auth/login/">{t('Back to login')}</LinkButton>
    </Stack>
  );
}
