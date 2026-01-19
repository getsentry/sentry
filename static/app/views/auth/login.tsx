import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AuthConfig} from 'sentry/types/auth';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';

import LoginForm from './loginForm';
import RegisterForm from './registerForm';
import SsoForm from './ssoForm';

const FORM_COMPONENTS = {
  login: LoginForm,
  register: RegisterForm,
  sso: SsoForm,
} as const;

type ActiveTab = keyof typeof FORM_COMPONENTS;

type TabConfig = [key: ActiveTab, label: string, disabled?: boolean];

type AuthConfigResponse = Omit<
  AuthConfig,
  'vstsLoginLink' | 'githubLoginLink' | 'googleLoginLink'
> & {
  github_login_link?: string;
  google_login_link?: string;
  vsts_login_link?: string;
};

function Login() {
  const {orgId} = useParams<{orgId?: string}>();
  const [activeTab, setActiveTab] = useState<ActiveTab>('login');

  const {
    data: response,
    isPending,
    isError,
    refetch,
  } = useApiQuery<AuthConfigResponse>(['/auth/config/'], {
    staleTime: 0,
  });

  const authConfig = useMemo((): AuthConfig | null => {
    if (!response) {
      return null;
    }
    const {vsts_login_link, github_login_link, google_login_link, ...config} = response;
    return {
      ...config,
      vstsLoginLink: vsts_login_link ?? '',
      githubLoginLink: github_login_link ?? '',
      googleLoginLink: google_login_link ?? '',
    };
  }, [response]);

  const hasAuthProviders =
    !!authConfig?.githubLoginLink ||
    !!authConfig?.vstsLoginLink ||
    !!authConfig?.googleLoginLink;

  const FormComponent = FORM_COMPONENTS[activeTab];

  const tabs: TabConfig[] = [
    ['login', t('Login')],
    ['sso', t('Single Sign-On')],
    ['register', t('Register'), !authConfig?.canRegister],
  ];

  return (
    <Fragment>
      <Header>
        <Heading>{t('Sign in to continue')}</Heading>
        <TabsContainer>
          <Tabs
            value={activeTab}
            onChange={tab => {
              setActiveTab(tab);
            }}
          >
            <TabList>
              {tabs
                .map(([key, label, disabled]) => {
                  if (disabled) {
                    return null;
                  }
                  return <TabList.Item key={key}>{label}</TabList.Item>;
                })
                .filter(n => !!n)}
            </TabList>
          </Tabs>
        </TabsContainer>
      </Header>
      {isPending && <LoadingIndicator />}

      {isError && (
        <StyledLoadingError
          message={t('Unable to load authentication configuration')}
          onRetry={refetch}
        />
      )}
      {!isPending && authConfig !== null && !isError && (
        <FormWrapper hasAuthProviders={hasAuthProviders}>
          {orgId !== undefined && (
            <Alert.Container>
              <Alert
                variant="warning"
                trailingItems={
                  <LinkButton to="/" size="xs">
                    Reload
                  </LinkButton>
                }
              >
                {tct(
                  "Experimental SPA mode does not currently support SSO style login. To develop against the [org] you'll need to copy your production session cookie.",
                  {org: orgId}
                )}
              </Alert>
            </Alert.Container>
          )}
          <FormComponent {...{authConfig}} />
        </FormWrapper>
      )}
    </Fragment>
  );
}

const StyledLoadingError = styled(LoadingError)`
  margin: ${space(2)};
`;

const Header = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: 20px 40px 0;
`;

const Heading = styled('h3')`
  font-size: 24px;
  margin: 0 0 20px 0;
`;

const TabsContainer = styled(Tabs)`
  margin-bottom: ${space(2)};
`;

const FormWrapper = styled('div')<{hasAuthProviders: boolean}>`
  padding: 35px;
  width: ${p => (p.hasAuthProviders ? '600px' : '490px')};
`;

export default Login;
