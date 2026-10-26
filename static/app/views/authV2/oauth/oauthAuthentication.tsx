import {useCallback, useState} from 'react';
import {css} from '@emotion/react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {AuthConfig} from 'sentry/types/auth';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {AccountAuthentication} from 'sentry/views/authV2/authLogin/components/accountAuthentication';
import {OrganizationCard} from 'sentry/views/authV2/authLogin/components/organizationCard';
import {OrganizationSlugInput} from 'sentry/views/authV2/authLogin/components/organizationSlugInput';
import {OrganizationSsoButton} from 'sentry/views/authV2/authLogin/components/organizationSsoButton';
import {useAuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';
import type {AuthenticatedResult, MfaMethod} from 'sentry/views/authV2/authLogin/types';

interface OAuthAuthenticationProps {
  authConfig: AuthConfig;
  onAuthenticated: (result: AuthenticatedResult, config: AuthConfig) => void;
  returnTo: string;
  isPreparingConsent?: boolean;
}

export function OAuthAuthentication({
  authConfig,
  isPreparingConsent = false,
  onAuthenticated,
  returnTo,
}: OAuthAuthenticationProps) {
  const handleAuthenticated = useCallback(
    (result: AuthenticatedResult) => onAuthenticated(result, authConfig),
    [authConfig, onAuthenticated]
  );
  const [mfaMethods, setMfaMethods] = useState<MfaMethod[] | null>();
  const [organizationSlug, setOrganizationSlug] = useState(
    authConfig.singleOrganizationSlug
  );
  const [showOrganizationInput, setShowOrganizationInput] = useState(false);
  const organizationQuery = useAuthOrganization(organizationSlug);
  const organization = organizationQuery.data;
  const requiresSso = organization?.ssoRequired && !organization.authenticated;
  const pendingMfa =
    mfaMethods === undefined
      ? authConfig.pendingMfa?.mfaMethods
      : (mfaMethods ?? undefined);

  if (!pendingMfa && organizationSlug && organizationQuery.isPending) {
    return null;
  }

  if (!pendingMfa && organizationSlug && organizationQuery.isError) {
    return (
      <Stack gap="md">
        <Alert variant="danger">
          {getRequestErrorUserMessage(organizationQuery.error)}
        </Alert>
        <Button onClick={() => void organizationQuery.refetch()}>{t('Try again')}</Button>
      </Stack>
    );
  }

  return (
    <fieldset
      disabled={isPreparingConsent}
      aria-busy={isPreparingConsent}
      css={css`
        border: 0;
        margin: 0;
        padding: 0;
        min-width: 0;
      `}
    >
      <AccountAuthentication
        authConfig={requiresSso ? undefined : authConfig}
        mfaMethods={pendingMfa}
        onMfaRequired={setMfaMethods}
        onCancelMfa={() => setMfaMethods(null)}
        onAuthenticated={handleAuthenticated}
        organizationSlug={organizationSlug}
        showEmailAuth={!requiresSso}
      >
        <AccountAuthentication.Context>
          {organization ? (
            <OrganizationCard
              authOrganization={organization}
              onClear={() => {
                setOrganizationSlug(undefined);
                setShowOrganizationInput(false);
              }}
              action={
                <OrganizationSsoButton
                  authOrganization={organization}
                  ssoFormAction={`/auth/login/${encodeURIComponent(organization.organization.slug)}/?next=${encodeURIComponent(returnTo)}`}
                />
              }
            />
          ) : showOrganizationInput ? (
            <OrganizationSlugInput
              onCancel={() => setShowOrganizationInput(false)}
              onSelect={setOrganizationSlug}
            />
          ) : (
            <Button onClick={() => setShowOrganizationInput(true)}>
              {t('Sign in with SSO')}
            </Button>
          )}
        </AccountAuthentication.Context>
      </AccountAuthentication>
    </fieldset>
  );
}
