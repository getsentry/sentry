import {Fragment} from 'react';
import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {browserHistory} from 'sentry/utils/browserHistory';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
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

type Props = RouteComponentProps<{memberId: string; token: string; orgId?: string}, {}>;

type State = DeprecatedAsyncView['state'] & {
  acceptError: boolean | undefined;
  accepting: boolean | undefined;
  inviteDetails: InviteDetails;
};

class AcceptOrganizationInvite extends DeprecatedAsyncView<Props, State> {
  disableErrorReport = false;

  get orgSlug(): string | null {
    const {params} = this.props;
    if (params.orgId) {
      return params.orgId;
    }
    const customerDomain = ConfigStore.get('customerDomain');
    if (customerDomain?.subdomain) {
      return customerDomain.subdomain;
    }
    return null;
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {memberId, token} = this.props.params;
    if (this.orgSlug) {
      return [['inviteDetails', `/accept-invite/${this.orgSlug}/${memberId}/${token}/`]];
    }
    return [['inviteDetails', `/accept-invite/${memberId}/${token}/`]];
  }

  getTitle() {
    return t('Accept Organization Invite');
  }

  handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    logout(this.api);
  };

  handleLogoutAndRetry = (e: React.MouseEvent) => {
    const {memberId, token} = this.props.params;
    e.preventDefault();
    logout(this.api, `/accept/${memberId}/${token}/`);
  };

  handleAcceptInvite = async () => {
    const {memberId, token} = this.props.params;

    this.setState({accepting: true});
    try {
      if (this.orgSlug) {
        await this.api.requestPromise(
          `/accept-invite/${this.orgSlug}/${memberId}/${token}/`,
          {
            method: 'POST',
          }
        );
      } else {
        await this.api.requestPromise(`/accept-invite/${memberId}/${token}/`, {
          method: 'POST',
        });
      }
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
          <LinkButton priority="primary" to="/settings/account/security/">
            {t('Configure Two-Factor Auth')}
          </LinkButton>
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
    /**
     * NOTE (mifu67): this error view could show up for multiple reasons, including:
     * invite link expired, signed into account that is already in the inviting
     * org, and invite not approved. Previously, the message seemed to indivate that
     * the link had expired, regardless of which error prompted it, so update the
     * error message to be a little more helpful.
     */
    return (
      <NarrowLayout>
        <Alert type="warning">
          {tct(
            'This organization invite link is invalid. It may be expired, or you may need to [switchLink:sign in with a different account].',
            {
              switchLink: (
                <Link
                  to=""
                  data-test-id="existing-member-link"
                  onClick={this.handleLogoutAndRetry}
                />
              ),
            }
          )}
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
