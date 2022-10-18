import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';

import {logout} from 'sentry/actionCreators/account';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type InviteDetails = {
  existingMember: boolean;
  hasAuthProvider: boolean;
  needs2fa: boolean;
  needsAuthentication: boolean;
  needsEmailVerification: boolean;
  orgSlug: string;
  requireSso: boolean;
  ssoProvider?: string;
};

type Props = RouteComponentProps<{memberId: string; token: string}, {}>;

type State = AsyncView['state'] & {
  acceptError: boolean | undefined;
  accepting: boolean | undefined;
  inviteDetails: InviteDetails;
};

class AcceptOrganizationInvite extends AsyncView<Props, State> {
  disableErrorReport = false;

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {memberId, token} = this.props.params;
    return [['inviteDetails', `/accept-invite/${memberId}/${token}/`]];
  }

  getTitle() {
    return t('Accept Organization Invite');
  }

  makeNextUrl(path: string) {
    return `${path}?${urlEncode({next: window.location.pathname})}`;
  }

  handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout(this.api);
    window.location.replace(this.makeNextUrl('/auth/login/'));
  };

  handleAcceptInvite = async () => {
    const {memberId, token} = this.props.params;

    this.setState({accepting: true});
    try {
      await this.api.requestPromise(`/accept-invite/${memberId}/${token}/`, {
        method: 'POST',
      });
      browserHistory.replace(`/${this.state.inviteDetails.orgSlug}/`);
    } catch {
      this.setState({acceptError: true});
    }
    this.setState({accepting: false});
  };

  get existingMemberAlert() {
    const user = ConfigStore.get('user');

    return (
      <Alert type="warning" data-test-id="existing-member">
        {tct(
          'Your account ([email]) is already a member of this organization. [switchLink:Switch accounts]?',
          {
            email: user.email,
            switchLink: (
              <Link
                to=""
                data-test-id="existing-member-link"
                onClick={this.handleLogout}
              />
            ),
          }
        )}
      </Alert>
    );
  }

  get authenticationActions() {
    const {inviteDetails} = this.state;

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
              <Button
                data-test-id="sso-login"
                priority="primary"
                href={this.makeNextUrl(`/auth/login/${inviteDetails.orgSlug}/`)}
              >
                {t('Join with %s', inviteDetails.ssoProvider)}
              </Button>
            )}
            {!inviteDetails.requireSso && (
              <Button
                data-test-id="create-account"
                priority="primary"
                href={this.makeNextUrl('/auth/register/')}
              >
                {t('Create a new account')}
              </Button>
            )}
          </ActionsLeft>
          {!inviteDetails.requireSso && (
            <ExternalLink
              href={this.makeNextUrl('/auth/login/')}
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

  get warning2fa() {
    const {inviteDetails} = this.state;

    return (
      <Fragment>
        <p data-test-id="2fa-warning">
          {tct(
            'To continue, [orgSlug] requires all members to configure two-factor authentication.',
            {orgSlug: inviteDetails.orgSlug}
          )}
        </p>
        <Actions>
          <Button priority="primary" to="/settings/account/security/">
            {t('Configure Two-Factor Auth')}
          </Button>
        </Actions>
      </Fragment>
    );
  }

  get warningEmailVerification() {
    const {inviteDetails} = this.state;

    return (
      <Fragment>
        <p data-test-id="email-verification-warning">
          {tct(
            'To continue, [orgSlug] requires all members to verify their email address.',
            {orgSlug: inviteDetails.orgSlug}
          )}
        </p>
        <Actions>
          <Button priority="primary" to="/settings/account/emails/">
            {t('Verify Email Address')}
          </Button>
        </Actions>
      </Fragment>
    );
  }

  get acceptActions() {
    const {inviteDetails, accepting} = this.state;

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
              <Button
                data-test-id="sso-login"
                priority="primary"
                href={this.makeNextUrl(`/auth/login/${inviteDetails.orgSlug}/`)}
              >
                {t('Join with %s', inviteDetails.ssoProvider)}
              </Button>
            )}

            <Button
              data-test-id="join-organization"
              priority="primary"
              disabled={accepting}
              onClick={this.handleAcceptInvite}
            >
              {t('Join the %s organization', inviteDetails.orgSlug)}
            </Button>
          </ActionsLeft>
        </Actions>
      </Fragment>
    );
  }

  renderError() {
    return (
      <NarrowLayout>
        <Alert type="warning">
          {t('This organization invite link is no longer valid.')}
        </Alert>
      </NarrowLayout>
    );
  }

  renderBody() {
    const {inviteDetails, acceptError} = this.state;

    return (
      <NarrowLayout>
        <SettingsPageHeader title={t('Accept organization invite')} />
        {acceptError && (
          <Alert type="error">
            {t('Failed to join this organization. Please try again')}
          </Alert>
        )}
        <InviteDescription data-test-id="accept-invite">
          {tct('[orgSlug] is using Sentry to track and debug errors.', {
            orgSlug: <strong>{inviteDetails.orgSlug}</strong>,
          })}
        </InviteDescription>
        {inviteDetails.needsAuthentication
          ? this.authenticationActions
          : inviteDetails.existingMember
          ? this.existingMemberAlert
          : inviteDetails.needs2fa
          ? this.warning2fa
          : inviteDetails.needsEmailVerification
          ? this.warningEmailVerification
          : inviteDetails.requireSso
          ? this.authenticationActions
          : this.acceptActions}
      </NarrowLayout>
    );
  }
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
