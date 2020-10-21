import {RouteComponentProps} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';
import {urlEncode} from '@sentry/utils';
import { Fragment, MouseEvent } from 'react';
import styled from '@emotion/styled';

import {logout} from 'app/actionCreators/account';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import NarrowLayout from 'app/components/narrowLayout';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import space from 'app/styles/space';

type InviteDetails = {
  orgSlug: string;
  needsAuthentication: boolean;
  needs2fa: boolean;
  needsSso: boolean;
  requireSso: boolean;
  existingMember: boolean;
  ssoProvider?: string;
};

type Props = RouteComponentProps<{memberId: string; token: string}, {}>;

type State = AsyncView['state'] & {
  inviteDetails: InviteDetails;
  accepting: boolean | undefined;
  acceptError: boolean | undefined;
};

class AcceptOrganizationInvite extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
    const {memberId, token} = this.props.params;
    return [['inviteDetails', `/accept-invite/${memberId}/${token}/`]];
  }

  getTitle() {
    return t('Accept Organization Invite');
  }

  makeNextUrl(path: string) {
    return `${path}?${urlEncode({next: window.location.pathname})}`;
  }

  handleLogout = async (e: MouseEvent) => {
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

        {inviteDetails.needsSso && (
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
            {inviteDetails.needsSso && (
              <Button
                label="sso-login"
                priority="primary"
                href={this.makeNextUrl(`/auth/login/${inviteDetails.orgSlug}/`)}
              >
                {t('Join with %s', inviteDetails.ssoProvider)}
              </Button>
            )}
            {!inviteDetails.requireSso && (
              <Button
                label="create-account"
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

  get acceptActions() {
    const {inviteDetails, accepting} = this.state;

    return (
      <Actions>
        <Button
          label="join-organization"
          priority="primary"
          disabled={accepting}
          onClick={this.handleAcceptInvite}
        >
          {t('Join the %s organization', inviteDetails.orgSlug)}
        </Button>
      </Actions>
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
