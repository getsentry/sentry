import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';
import {IconGithub, IconGoogle, IconLab, IconSentry, IconVsts} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {AuthConfig} from 'sentry/types/auth';
import {isNotFoundError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {AuthV2CookieState, useEnableAuthV2} from 'sentry/utils/useEnableAuthV2';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import {EmailAuth} from './components/emailAuth';
import {OrganizationAuth} from './components/organizationAuth';
import {OrganizationSlugInput} from './components/organizationSlugInput';
import {SecondFactorAuth} from './components/secondFactorAuth';
import {useAuthConfig} from './hooks/useAuthConfig';
import {useAuthOrganization} from './hooks/useAuthOrganization';
import type {EmailAuthResult} from './hooks/useEmailAuth';
import type {AuthenticatedResult, MfaMethod} from './types';

type AuthProviderLinkKey = keyof Pick<
  AuthConfig,
  'githubLoginLink' | 'googleLoginLink' | 'vstsLoginLink'
>;

const AUTH_PROVIDER_CONFIG = {
  googleLoginLink: {label: t('Google'), icon: <IconGoogle />},
  githubLoginLink: {label: t('GitHub'), icon: <IconGithub />},
  vstsLoginLink: {label: t('Azure'), icon: <IconVsts />},
} satisfies Record<AuthProviderLinkKey, {icon: React.ReactNode; label: string}>;

export default function AuthLogin() {
  const {orgSlug} = useParams<{orgSlug?: string}>();
  const location = useLocation();
  const {setAuthV2CookieState} = useEnableAuthV2();

  const returnToLegacyLogin = () => {
    setAuthV2CookieState(AuthV2CookieState.DISABLED);
    testableWindowLocation.reload();
  };

  const {
    data: authConfig,
    error: authConfigError,
    isFetching: isAuthConfigFetching,
    isPending: isAuthConfigPending,
    refetch: refetchAuthConfig,
  } = useAuthConfig();
  const {
    data: authOrganization,
    error: authOrganizationError,
    isFetching: isAuthOrganizationFetching,
    isPending: isAuthOrganizationPending,
    refetch: refetchAuthOrganization,
  } = useAuthOrganization(orgSlug);

  const nextUri = authConfig && 'nextUri' in authConfig ? authConfig.nextUri : undefined;
  const loginConfig = authConfig && !('nextUri' in authConfig) ? authConfig : undefined;

  // An authenticated user may still need to authenticate with an organization's SSO
  // provider before its APIs will grant access. Keep that organization in focus instead
  // of following the generic authenticated-user redirect.
  const focusedOrgAuth = Boolean(
    orgSlug && nextUri && authOrganization && !authOrganization.memberAuthenticated
  );
  const isAuthOrganizationNotFound = isNotFoundError(authOrganizationError);
  const hasAuthOrganizationError = Boolean(
    authOrganizationError && !isAuthOrganizationNotFound
  );
  const hasInitialAuthConfigError = Boolean(authConfigError && !authConfig);

  useEffect(() => {
    if (
      nextUri &&
      (!orgSlug || authOrganization?.memberAuthenticated || isAuthOrganizationNotFound)
    ) {
      testableWindowLocation.assign(nextUri);
    }
  }, [
    authOrganization?.memberAuthenticated,
    isAuthOrganizationNotFound,
    nextUri,
    orgSlug,
  ]);

  const navigate = useNavigate();
  const authProviderButtons = loginConfig
    ? (
        Object.entries(AUTH_PROVIDER_CONFIG) as Array<
          [AuthProviderLinkKey, (typeof AUTH_PROVIDER_CONFIG)[AuthProviderLinkKey]]
        >
      ).flatMap(([key, provider]) => {
        const href = loginConfig[key];
        return href ? [{...provider, href, id: key}] : [];
      })
    : [];
  const [mfaMethods, setMfaMethods] = useState<MfaMethod[]>();
  const pendingMfaMethods = mfaMethods ?? loginConfig?.pendingMfa?.mfaMethods;
  const [isOrganizationSlugInputVisible, setIsOrganizationSlugInputVisible] =
    useState(false);

  const completeAuthentication = useCallback((result: AuthenticatedResult) => {
    testableWindowLocation.assign(result.nextUri);
  }, []);

  const handleSelectOrganization = useCallback(
    (organizationSlug: string) => {
      navigate({pathname: `/auth/login/${encodeURIComponent(organizationSlug)}/`});
    },
    [navigate]
  );

  const handleAuthResult = useCallback(
    (result: EmailAuthResult) => {
      if (result.status === 'mfa-required') {
        setMfaMethods(result.methods);
        navigate(location, {replace: true, state: null});
        return;
      }

      completeAuthentication(result);
    },
    [completeAuthentication, location, navigate]
  );

  if (
    isAuthConfigPending ||
    (orgSlug && isAuthOrganizationPending) ||
    (nextUri && !focusedOrgAuth && !hasAuthOrganizationError)
  ) {
    return null;
  }

  return (
    <Fragment>
      <BrandPageLayout.HeaderStart>
        <IconSentry size="xl" />
      </BrandPageLayout.HeaderStart>

      <BrandPageLayout.HeaderEnd>
        <Stack align="end" gap="sm" maxWidth="300px">
          <Tag variant="warning" icon={<IconLab isSolid />}>
            {t('New Experience')}
          </Tag>
          <Text as="div" align="right" size="sm" variant="muted">
            {tct('Having problems logging in? [legacyLogin]', {
              legacyLogin: (
                <Button size="zero" variant="link" onClick={returnToLegacyLogin}>
                  {t('Return to the old login experience')}
                </Button>
              ),
            })}
          </Text>
        </Stack>
      </BrandPageLayout.HeaderEnd>

      <Stack height="100%" align="center" justify="between" gap="2xl">
        <LoginContainer width="100%" maxWidth="360px" gap="2xl">
          <Heading as="h1" size="3xl" align="center">
            {t('Sign in to Sentry')}
          </Heading>

          <Stack gap="lg">
            {hasInitialAuthConfigError ? (
              <Stack gap="md">
                <Alert variant="danger">
                  {t('Unable to load the login page. Try again.')}
                </Alert>
                <Button busy={isAuthConfigFetching} onClick={() => refetchAuthConfig()}>
                  {t('Retry')}
                </Button>
              </Stack>
            ) : hasAuthOrganizationError ? (
              <Stack gap="md">
                <Alert variant="danger">
                  {t('Unable to load organization authentication. Please try again.')}
                </Alert>
                <Button
                  busy={isAuthOrganizationFetching}
                  onClick={() => refetchAuthOrganization()}
                >
                  {t('Retry')}
                </Button>
              </Stack>
            ) : pendingMfaMethods ? (
              <SecondFactorAuth
                methods={pendingMfaMethods}
                onBack={() => {
                  setMfaMethods(undefined);
                }}
                onComplete={completeAuthentication}
              />
            ) : (
              <Fragment>
                <Stack gap="md">
                  {!focusedOrgAuth && authProviderButtons.length > 0 && (
                    <Grid
                      columns={`repeat(${authProviderButtons.length}, minmax(0, 1fr))`}
                      gap="sm"
                    >
                      {authProviderButtons.map(button => (
                        <LinkButton
                          key={button.id}
                          href={button.href}
                          icon={button.icon}
                          size="sm"
                        >
                          {button.label}
                        </LinkButton>
                      ))}
                    </Grid>
                  )}
                  {authOrganization ? (
                    <OrganizationAuth
                      authOrganization={authOrganization}
                      onClear={
                        focusedOrgAuth
                          ? undefined
                          : () => navigate({pathname: '/auth/login/'})
                      }
                    />
                  ) : isOrganizationSlugInputVisible ? (
                    <OrganizationSlugInput
                      onCancel={() => setIsOrganizationSlugInputVisible(false)}
                      onSelect={handleSelectOrganization}
                    />
                  ) : (
                    <Button onClick={() => setIsOrganizationSlugInputVisible(true)}>
                      {t('Organization SSO')}
                    </Button>
                  )}
                </Stack>

                {!focusedOrgAuth && (
                  <Fragment>
                    <Text as="div" align="center" variant="muted" size="lg">
                      {t('or')}
                    </Text>

                    <EmailAuth
                      organizationSlug={orgSlug}
                      onAuthResult={handleAuthResult}
                    />
                  </Fragment>
                )}
              </Fragment>
            )}
          </Stack>
        </LoginContainer>

        {loginConfig?.loginBanner && (
          <Alert variant="muted">
            {/* Login banners are trusted server and plugin configuration, matching the legacy template contract. */}
            <Text as="div" dangerouslySetInnerHTML={{__html: loginConfig.loginBanner}}>
              {null}
            </Text>
          </Alert>
        )}
      </Stack>
    </Fragment>
  );
}

const LoginContainer = styled(Stack)`
  padding-top: 18vh;
`;
