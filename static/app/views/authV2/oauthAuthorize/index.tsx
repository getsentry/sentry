import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {AccountBadge} from 'sentry/views/authV2/components/accountBadge';
import {ApplicationSummary} from 'sentry/views/authV2/oauth/applicationSummary';
import {ConsentActions} from 'sentry/views/authV2/oauth/consentActions';
import {OAuthAuthentication} from 'sentry/views/authV2/oauth/oauthAuthentication';
import {OAuthFlowTransition} from 'sentry/views/authV2/oauth/oauthFlowTransition';
import {OAuthLayout} from 'sentry/views/authV2/oauth/oauthLayout';
import {OrganizationConsentCard} from 'sentry/views/authV2/oauth/organizationConsentCard';
import {useOAuthOrganization} from 'sentry/views/authV2/oauth/useOAuthOrganization';
import {useAuthPageLoading} from 'sentry/views/authV2/useAuthPageLoading';

import {useOAuthAuthorizeFlow} from './useOAuthAuthorizeFlow';

export default function OAuthAuthorize() {
  const {state, actions} = useOAuthAuthorizeFlow();
  const {organization, onChange: onOrganizationChange} = useOAuthOrganization(
    state.status === 'consent' ? state.consent.organizationOptions : [],
    state.status === 'consent' ? state.consent.transactionId : undefined
  );
  const isLoading = state.status === 'loading' || state.status === 'submitting';
  useAuthPageLoading(isLoading);

  if (isLoading) {
    return null;
  }

  return (
    <OAuthLayout>
      {state.context && (
        <Stack gap="sm">
          <Text as="p" size="sm" variant="muted" align="left">
            {t("You're authorizing…")}
          </Text>
          <ApplicationSummary context={state.context} />
        </Stack>
      )}
      <OAuthFlowTransition step={state.status}>
        {state.context && state.user?.id && state.status !== 'authentication' && (
          <Stack gap="sm">
            <Text as="p" size="sm" variant="muted" align="left">
              {t('With your account…')}
            </Text>
            <AccountBadge
              user={state.user}
              isSwitchingAccount={state.isSwitchingAccount}
              disabled={state.isSubmitting}
              onSwitchAccount={actions.switchAccount}
            />
          </Stack>
        )}
        {state.switchError && (
          <Alert variant="danger">{getRequestErrorUserMessage(state.switchError)}</Alert>
        )}
        {state.status === 'authentication' && (
          <Stack gap="lg">
            <Text as="p" size="sm" variant="muted" align="left">
              {t('Sign in to authorize this application…')}
            </Text>
            <OAuthAuthentication
              authConfig={state.authConfig}
              isPreparingConsent={state.isPreparingConsent}
              onAuthenticated={actions.onAuthenticated}
              returnTo={state.returnTo}
            />
          </Stack>
        )}
        {state.status === 'consent' && (
          <form
            onSubmit={event => {
              event.preventDefault();
              actions.decide('approve', organization?.id);
            }}
          >
            <Stack gap="lg">
              {state.context.application.requiresOrgLevelAccess && organization && (
                <Stack gap="sm">
                  <Text as="p" size="sm" variant="muted" align="left">
                    {t('With access only to…')}
                  </Text>
                  <OrganizationConsentCard
                    organization={organization}
                    organizations={state.consent.organizationOptions}
                    disabled={state.busy}
                    onChange={onOrganizationChange}
                  />
                </Stack>
              )}
              <ConsentActions
                application={state.context.application}
                busy={state.isSubmitting}
                disabled={state.busy}
                canApprove={
                  !state.context.application.requiresOrgLevelAccess || !!organization
                }
                onDeny={() => actions.decide('deny')}
              />
            </Stack>
          </form>
        )}
        {state.status === 'error' && <Alert variant="danger">{state.message}</Alert>}
        {state.status === 'error' && state.canRetry && (
          <Button onClick={actions.retry}>{t('Start over')}</Button>
        )}
      </OAuthFlowTransition>
    </OAuthLayout>
  );
}
