import {useTheme} from '@emotion/react';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import {OrganizationCard} from 'sentry/views/authV2/authLogin/components/organizationCard';
import {OrganizationSsoButton} from 'sentry/views/authV2/authLogin/components/organizationSsoButton';
import {getOrganizationSsoLoginUrl} from 'sentry/views/authV2/authLogin/utils';
import {useBrandedAuthLoading} from 'sentry/views/authV2/useBrandedAuthLoading';

import {InvitationAccountBadge} from './invitationAccountBadge';
import {InvitationAuthentication} from './invitationAuthentication';
import {InvitationLayout} from './invitationLayout';
import {InvitationStatus} from './invitationStatus';
import {useInvitationFlow} from './useInvitationFlow';

function AcceptOrganizationInvite() {
  const theme = useTheme();
  const params = useParams<{
    memberId: string;
    orgId: string;
    token: string;
  }>();
  const {state, actions} = useInvitationFlow(params);
  useBrandedAuthLoading(state.status === 'loading');

  if (state.status === 'loading') {
    return null;
  }

  const switchAccountError = state.hasSwitchAccountError ? (
    <Alert variant="danger">{t('Unable to switch accounts. Try again.')}</Alert>
  ) : null;

  if (state.status === 'invalid') {
    return (
      <InvitationLayout>
        <Alert variant="warning">
          {t(
            'This invitation is invalid or expired. Try signing in with a different account.'
          )}
        </Alert>
        {switchAccountError}
        <Button
          busy={state.isSwitchingAccount}
          disabled={state.isSwitchingAccount}
          onClick={actions.switchAccount}
        >
          {t('Switch account')}
        </Button>
      </InvitationLayout>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <InvitationLayout>
        <Alert variant="danger">{t('Unable to load this invitation. Try again.')}</Alert>
        <Button
          busy={state.isRetrying}
          disabled={state.isRetrying}
          onClick={actions.retryInvitation}
        >
          {t('Try again')}
        </Button>
      </InvitationLayout>
    );
  }

  const {authOrganization, initialEmail, loginConfig, signedInUser, step} = state;
  const isAuthenticatingAccount = step === 'authentication' || step === 'sign-in-sso';
  const ssoAction = authOrganization.provider ? (
    <OrganizationSsoButton
      authOrganization={authOrganization}
      hideWhenUnavailable
      ssoFormAction={getOrganizationSsoLoginUrl(authOrganization.organization.slug)}
    />
  ) : undefined;

  return (
    <InvitationLayout>
      <Stack gap={signedInUser ? 'lg' : '2xl'}>
        <Stack gap="sm">
          <Text as="p" size="sm" variant="muted" align="left">
            {t("You've been invited to join…")}
          </Text>
          <OrganizationCard authOrganization={authOrganization} action={ssoAction} />
        </Stack>

        <Stack position="relative">
          <AnimatePresence initial={false} mode="popLayout">
            <MotionStack
              key={isAuthenticatingAccount ? 'authentication' : 'account'}
              gap="2xl"
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 10}}
              transition={theme.motion.framer.smooth.moderate}
            >
              {signedInUser && (
                <Stack gap="sm">
                  <Text as="p" size="sm" variant="muted" align="left">
                    {t("You're joining with the account…")}
                  </Text>
                  <InvitationAccountBadge
                    user={signedInUser}
                    isSwitchingAccount={state.isSwitchingAccount}
                    onSwitchAccount={actions.switchAccount}
                  />
                </Stack>
              )}
              {switchAccountError}
              {state.hasAcceptError && (
                <Alert variant="danger">
                  {t('Failed to accept this invitation. Please try again.')}
                </Alert>
              )}
              {step === 'authentication' ? (
                <InvitationAuthentication
                  authConfig={loginConfig}
                  initialEmail={initialEmail}
                  onAuthenticated={actions.handleAuthenticated}
                />
              ) : (
                <Stack position="relative">
                  <AnimatePresence initial={false} mode="popLayout">
                    <MotionStack
                      key={step}
                      initial={{opacity: 0, y: -10}}
                      animate={{opacity: 1, y: 0}}
                      exit={{opacity: 0, y: 10}}
                      transition={theme.motion.framer.smooth.moderate}
                    >
                      <InvitationStatus
                        step={step}
                        isAccepting={state.isAccepting}
                        isCheckingInvite={state.isCheckingInvite}
                        isSwitchingAccount={state.isSwitchingAccount}
                        onAccept={actions.acceptInvitation}
                        onSwitchAccount={actions.switchAccount}
                      />
                    </MotionStack>
                  </AnimatePresence>
                </Stack>
              )}
            </MotionStack>
          </AnimatePresence>
        </Stack>
      </Stack>
    </InvitationLayout>
  );
}

const MotionStack = motion.create(Stack);

export default AcceptOrganizationInvite;
