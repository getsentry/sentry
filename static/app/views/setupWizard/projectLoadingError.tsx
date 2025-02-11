import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import type RequestError from 'sentry/utils/requestError/requestError';

function getSsoLoginUrl(error: RequestError) {
  const detail = error?.responseJSON?.detail as any;
  const loginUrl = detail?.extra?.loginUrl;

  if (!loginUrl || typeof loginUrl !== 'string') {
    return null;
  }

  try {
    // Pass a base param as the login may be absolute or relative
    const url = new URL(loginUrl, location.origin);
    // Pass the current URL as the next URL to redirect to after login
    url.searchParams.set('next', location.href);
    return url.toString();
  } catch {
    return null;
  }
}

export function ProjectLoadingError({
  error,
  onRetry,
}: {
  error: RequestError;
  onRetry: () => void;
}) {
  const detail = error?.responseJSON?.detail;
  const code = typeof detail === 'string' ? undefined : detail?.code;
  const ssoLoginUrl = getSsoLoginUrl(error);

  if (code === 'sso-required' && ssoLoginUrl) {
    return (
      <AlertWithoutMargin
        type="error"
        showIcon
        trailingItems={
          <LinkButton href={ssoLoginUrl} size="xs">
            {t('Log in')}
          </LinkButton>
        }
      >
        {t('This organization requires Single Sign-On.')}
      </AlertWithoutMargin>
    );
  }

  return (
    <LoadingErrorWithoutMargin
      message={t('Failed to load projects')}
      onRetry={() => {
        onRetry();
      }}
    />
  );
}

const AlertWithoutMargin = styled(Alert)`
  margin: 0;
`;

const LoadingErrorWithoutMargin = styled(LoadingError)`
  margin: 0;
`;
