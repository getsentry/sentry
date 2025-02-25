import {Fragment} from 'react';
import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {Button, LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type InviteDetails = {
  existingMember: boolean;
  hasAuthProvider: boolean;
  needs2fa: boolean;
  needsAuthentication: boolean;
  orgSlug: string;
  requireSso: boolean;
  ssoProvider?: string;
};

function AcceptActions({
  inviteDetails,
  isAccepting,
  acceptInvite,
}: {
  acceptInvite: () => void;
  inviteDetails: InviteDetails;
  isAccepting: boolean;
}) {
  return (
    <Fragment>
      {inviteDetails.hasAuthProvider && !inviteDetails.requireSso && (
        <p data-test-id="action-info-sso">
          {tct(
            `Note that [orgSlug] has enabled Single Sign-On (SSO) using
             [authProvider]. You may join the organization by authenticating with
             the organization's SSO provider or via your standard account authentication.`,
            {
              orgSlug: <strong>{inviteDetails.orgSlug}</strong>,
              authProvider: inviteDetails.ssoProvider,
            }
          )}
        </p>
      )}
      <Actions>
        <ActionsLeft>
          {inviteDetails.hasAuthProvider && !inviteDetails.requireSso && (
            <LinkButton
              data-test-id="sso-login"
              priority="primary"
              href={`/auth/login/${inviteDetails.orgSlug}/`}
            >
              {t('Join with %s', inviteDetails.ssoProvider)}
            </LinkButton>
          )}

          <Button
            data-test-id="join-organization"
            priority="primary"
            busy={isAccepting}
            disabled={isAccepting}
            onClick={acceptInvite}
          >
            {t('Join the %s organization', inviteDetails.orgSlug)}
          </Button>
        </ActionsLeft>
      </Actions>
    </Fragment>
  );
}

function ExistingMemberAlert() {
  const api = useApi({persistInFlight: true});
  const user = ConfigStore.get('user');

  return (
    <Alert.Container>
      <Alert type="warning" data-test-id="existing-member">
        {tct(
          'Your account ([email]) is already a member of this organization. [switchLink:Switch accounts]?',
          {
            email: user.email,
            switchLink: (
              <Link
                to=""
                data-test-id="existing-member-link"
                onClick={e => {
                  e.preventDefault();
                  logout(api);
                }}
              />
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}

function Warning2fa({inviteDetails}: {inviteDetails: InviteDetails}) {
  const sentryUrl = ConfigStore.get('links').sentryUrl;
  return (
    <Fragment>
      <p data-test-id="2fa-warning">
        {tct(
          'To continue, [orgSlug] requires all members to configure two-factor authentication.',
          {orgSlug: inviteDetails.orgSlug}
        )}
      </p>
      <Actions>
        <LinkButton
          external
          priority="primary"
          href={`${sentryUrl}/settings/account/security/`}
        >
          {t('Configure Two-Factor Auth')}
        </LinkButton>
      </Actions>
    </Fragment>
  );
}

function AuthenticationActions({inviteDetails}: {inviteDetails: InviteDetails}) {
  return (
    <Fragment>
      {!inviteDetails.requireSso && (
        <p data-test-id="action-info-general">
          {t(
            `To continue, you must either create a new account, or login to an
            existing Sentry account.`
          )}
        </p>
      )}

      {inviteDetails.hasAuthProvider && (
        <p data-test-id="action-info-sso">
          {inviteDetails.requireSso
            ? tct(
                `Note that [orgSlug] has required Single Sign-On (SSO) using
             [authProvider]. You may create an account by authenticating with
             the organization's SSO provider.`,
                {
                  orgSlug: <strong>{inviteDetails.orgSlug}</strong>,
                  authProvider: inviteDetails.ssoProvider,
                }
              )
            : tct(
                `Note that [orgSlug] has enabled Single Sign-On (SSO) using
             [authProvider]. You may create an account by authenticating with
             the organization's SSO provider.`,
                {
                  orgSlug: <strong>{inviteDetails.orgSlug}</strong>,
                  authProvider: inviteDetails.ssoProvider,
                }
              )}
        </p>
      )}

      <Actions>
        <ActionsLeft>
          {inviteDetails.hasAuthProvider && (
            <LinkButton
              data-test-id="sso-login"
              priority="primary"
              href={`/auth/login/${inviteDetails.orgSlug}/`}
            >
              {t('Join with %s', inviteDetails.ssoProvider)}
            </LinkButton>
          )}
          {!inviteDetails.requireSso && (
            <LinkButton
              data-test-id="create-account"
              priority="primary"
              href="/auth/register/"
            >
              {t('Create a new account')}
            </LinkButton>
          )}
        </ActionsLeft>
        {!inviteDetails.requireSso && (
          <ExternalLink
            href="/auth/login/"
            openInNewTab={false}
            data-test-id="link-with-existing"
          >
            {t('Login using an existing account')}
          </ExternalLink>
        )}
      </Actions>
    </Fragment>
  );
}

function AcceptOrganizationInvite() {
  const api = useApi({persistInFlight: true});
  const params = useParams<{memberId: string; token: string; orgId?: string}>();

  const orgSlug = params.orgId || ConfigStore.get('customerDomain')?.subdomain || null;

  const {
    data: inviteDetails,
    isPending,
    isError,
  } = useApiQuery<InviteDetails>(
    orgSlug
      ? [`/accept-invite/${orgSlug}/${params.memberId}/${params.token}/`]
      : [`/accept-invite/${params.memberId}/${params.token}/`],
    {
      staleTime: Infinity,
      retry: false,
    }
  );

  const {
    mutate: acceptInvite,
    isPending: isAccepting,
    isError: isAcceptError,
  } = useMutation({
    mutationFn: () =>
      api.requestPromise(
        orgSlug
          ? `/accept-invite/${orgSlug}/${params.memberId}/${params.token}/`
          : `/accept-invite/${params.memberId}/${params.token}/`,
        {
          method: 'POST',
        }
      ),
    onSuccess: () => {
      if (inviteDetails?.orgSlug) {
        window.location.href = `/${inviteDetails.orgSlug}/`;
      }
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <NarrowLayout>
        <Alert.Container>
          <Alert type="warning">
            {tct(
              'This organization invite link is invalid. It may be expired, or you may need to [switchLink:sign in with a different account].',
              {
                switchLink: (
                  <Link
                    to=""
                    data-test-id="existing-member-link"
                    onClick={e => {
                      e.preventDefault();
                      logout(api, `/accept/${params.memberId}/${params.token}/`);
                    }}
                  />
                ),
              }
            )}
          </Alert>
        </Alert.Container>
      </NarrowLayout>
    );
  }

  return (
    <NarrowLayout>
      <SentryDocumentTitle title={t('Accept Organization Invite')} />
      <SettingsPageHeader title={t('Accept organization invite')} />
      {isAcceptError && (
        <Alert.Container>
          <Alert type="error">
            {t('Failed to join this organization. Please try again')}
          </Alert>
        </Alert.Container>
      )}
      <InviteDescription data-test-id="accept-invite">
        {tct('[orgSlug] is using Sentry to track and debug errors.', {
          orgSlug: <strong>{inviteDetails.orgSlug}</strong>,
        })}
      </InviteDescription>
      {inviteDetails.needsAuthentication ? (
        <AuthenticationActions inviteDetails={inviteDetails} />
      ) : inviteDetails.existingMember ? (
        <ExistingMemberAlert />
      ) : inviteDetails.needs2fa ? (
        <Warning2fa inviteDetails={inviteDetails} />
      ) : inviteDetails.requireSso ? (
        <AuthenticationActions inviteDetails={inviteDetails} />
      ) : (
        <AcceptActions
          inviteDetails={inviteDetails}
          isAccepting={isAccepting}
          acceptInvite={acceptInvite}
        />
      )}
    </NarrowLayout>
  );
}

const Actions = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(3)};
`;
const ActionsLeft = styled('span')`
  > a {
    margin-right: ${space(1)};
  }
`;

const InviteDescription = styled('p')`
  font-size: 1.2em;
`;
export default AcceptOrganizationInvite;
