import {useMutation} from '@tanstack/react-query';
import {useStore} from 'zustand';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {logout} from 'sentry/actionCreators/account';
import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useUser} from 'sentry/utils/useUser';
import {useAuthPageLoading} from 'sentry/views/authV2/useAuthPageLoading';

/**
 * Only same-origin destinations are allowed, so a crafted logout link can't
 * send people to another site after they sign out.
 */
function getSafeRedirectUrl(next: unknown): string | undefined {
  if (typeof next !== 'string' || next === '') {
    return undefined;
  }

  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) {
      return undefined;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export default function AuthLogout() {
  const api = useApi({persistInFlight: true});
  const location = useLocation();
  const user = useUser();
  const isAuthenticated = useStore(ConfigStore, state => state.isAuthenticated);
  useAuthPageLoading(false);

  const redirectUrl = getSafeRedirectUrl(location.query.next);
  const logoutMutation = useMutation({
    mutationFn: () => logout(api, {redirectUrl}),
  });

  return (
    <Stack width="100%" maxWidth="360px" gap="2xl">
      <SentryDocumentTitle title={t('Sign out')} />
      <Heading as="h1" size="3xl" align="center">
        {t('Sign out')}
      </Heading>
      {isAuthenticated ? (
        <Stack gap="lg">
          <Text align="center" variant="muted">
            {t('Are you sure you want to sign out of Sentry?')}
          </Text>
          <Stack border="secondary" radius="md" padding="lg">
            <UserBadge user={user} avatarSize={32} />
          </Stack>
          {logoutMutation.isError && (
            <Alert variant="danger">
              {getRequestErrorUserMessage(
                logoutMutation.error,
                t('Unable to sign you out. Try again.')
              )}
            </Alert>
          )}
          <Button
            variant="primary"
            busy={logoutMutation.isPending || logoutMutation.isSuccess}
            disabled={logoutMutation.isPending || logoutMutation.isSuccess}
            onClick={() => logoutMutation.mutate()}
          >
            {t('Sign out')}
          </Button>
        </Stack>
      ) : (
        <Stack gap="lg">
          <Text align="center" variant="muted">
            {t('You are signed out.')}
          </Text>
          <LinkButton variant="primary" to="/auth/login/">
            {t('Sign in')}
          </LinkButton>
        </Stack>
      )}
    </Stack>
  );
}
