import {Fragment, useCallback} from 'react';
import {IconGithub} from '@sentry/icons/github';
import {IconGoogle} from '@sentry/icons/google';
import {IconVsts} from '@sentry/icons/vsts';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {slot} from '@sentry/scraps/slot';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {AuthConfig} from 'sentry/types/auth';
import {EmailAuth} from 'sentry/views/authV2/authLogin/components/emailAuth';
import {SecondFactorAuth} from 'sentry/views/authV2/authLogin/components/secondFactorAuth';
import type {EmailAuthResult} from 'sentry/views/authV2/authLogin/hooks/useEmailAuth';
import type {AuthenticatedResult, MfaMethod} from 'sentry/views/authV2/authLogin/types';

type AuthProviderLinkKey = keyof Pick<
  AuthConfig,
  'githubLoginLink' | 'googleLoginLink' | 'vstsLoginLink'
>;

const AUTH_PROVIDER_CONFIG = {
  googleLoginLink: {label: t('Google'), icon: <IconGoogle />},
  githubLoginLink: {label: t('GitHub'), icon: <IconGithub />},
  vstsLoginLink: {label: t('Azure'), icon: <IconVsts />},
} satisfies Record<AuthProviderLinkKey, {icon: React.ReactNode; label: string}>;

const AccountAuthenticationSlot = slot(['context'] as const);

interface AccountAuthenticationProps {
  onAuthenticated: (result: AuthenticatedResult) => void;
  onCancelMfa: () => void;
  onMfaRequired: (methods: MfaMethod[]) => void;
  authConfig?: AuthConfig;
  children?: React.ReactNode;
  mfaMethods?: MfaMethod[];
  organizationSlug?: string;
  showEmailAuth?: boolean;
}

function AccountAuthenticationRoot({
  authConfig,
  children,
  mfaMethods,
  organizationSlug,
  onAuthenticated,
  onCancelMfa,
  onMfaRequired,
  showEmailAuth = true,
}: AccountAuthenticationProps) {
  const handleAuthResult = useCallback(
    (result: EmailAuthResult) => {
      if (result.status === 'mfa-required') {
        onMfaRequired(result.methods);
        return;
      }

      onAuthenticated(result);
    },
    [onAuthenticated, onMfaRequired]
  );

  if (mfaMethods) {
    return (
      <SecondFactorAuth
        methods={mfaMethods}
        onBack={onCancelMfa}
        onComplete={onAuthenticated}
      />
    );
  }

  const authProviderButtons = (
    Object.entries(AUTH_PROVIDER_CONFIG) as Array<
      [AuthProviderLinkKey, (typeof AUTH_PROVIDER_CONFIG)[AuthProviderLinkKey]]
    >
  ).flatMap(([key, provider]) => {
    const href = authConfig?.[key];
    return href ? [{...provider, href, id: key}] : [];
  });
  const hasAuthProviderButtons = authProviderButtons.length > 0;
  const authProviderGrid = hasAuthProviderButtons ? (
    <Grid columns={`repeat(${authProviderButtons.length}, minmax(0, 1fr))`} gap="sm">
      {authProviderButtons.map(button => (
        <LinkButton key={button.id} href={button.href} icon={button.icon} size="sm">
          {button.label}
        </LinkButton>
      ))}
    </Grid>
  ) : null;

  return (
    <AccountAuthenticationSlot.Provider>
      {children}
      <Stack gap="lg">
        <AccountAuthenticationSlot.Outlet name="context">
          {(props, hasContext) => {
            const hasAuthenticationContext = hasAuthProviderButtons || hasContext;
            const authenticationContext = hasAuthenticationContext ? (
              <Stack {...props} gap="md">
                {authProviderGrid}
              </Stack>
            ) : null;
            const divider =
              showEmailAuth && hasAuthenticationContext ? <AuthDivider /> : null;

            return (
              <Fragment>
                {authenticationContext}
                {divider}
              </Fragment>
            );
          }}
        </AccountAuthenticationSlot.Outlet>

        {showEmailAuth && (
          <EmailAuth
            organizationSlug={organizationSlug}
            onAuthResult={handleAuthResult}
          />
        )}
      </Stack>
    </AccountAuthenticationSlot.Provider>
  );
}

function AuthenticationContext({children}: {children: React.ReactNode}) {
  return <AccountAuthenticationSlot name="context">{children}</AccountAuthenticationSlot>;
}

function AuthDivider() {
  return (
    <Grid columns="1fr max-content 1fr" align="center" gap="lg">
      <Container borderTop="secondary" />
      <Text as="div" align="center" variant="muted" size="xs" uppercase>
        {t('or')}
      </Text>
      <Container borderTop="secondary" />
    </Grid>
  );
}

export const AccountAuthentication = Object.assign(AccountAuthenticationRoot, {
  Context: AuthenticationContext,
});
