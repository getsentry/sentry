import {cloneElement} from 'react';
import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import AsyncComponent from 'sentry/components/asyncComponent';
import {t} from 'sentry/locale';
import {Authenticator, OrganizationSummary, UserEmail} from 'sentry/types';
import {defined} from 'sentry/utils';

const ENDPOINT = '/users/me/authenticators/';

type Props = {
  children: React.ReactElement;
} & RouteComponentProps<{authId: string}, {}> &
  AsyncComponent['props'];

type State = {
  emails: UserEmail[];
  authenticators?: Authenticator[] | null;
  organizations?: OrganizationSummary[];
} & AsyncComponent['state'];

class AccountSecurityWrapper extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [
      ['authenticators', ENDPOINT],
      ['organizations', '/organizations/'],
      ['emails', '/users/me/emails/'],
    ];
  }

  handleDisable = async (auth: Authenticator) => {
    if (!auth || !auth.authId) {
      return;
    }

    this.setState({loading: true});

    try {
      await this.api.requestPromise(`${ENDPOINT}${auth.authId}/`, {method: 'DELETE'});
      this.remountComponent();
    } catch (_err) {
      this.setState({loading: false});
      addErrorMessage(t('Error disabling %s', auth.name));
    }
  };

  handleRegenerateBackupCodes = async () => {
    this.setState({loading: true});

    try {
      await this.api.requestPromise(`${ENDPOINT}${this.props.params.authId}/`, {
        method: 'PUT',
      });
      this.remountComponent();
    } catch (_err) {
      this.setState({loading: false});
      addErrorMessage(t('Error regenerating backup codes'));
    }
  };

  handleRefresh = () => {
    this.fetchData();
  };

  renderBody() {
    const {children} = this.props;
    const {authenticators, organizations, emails} = this.state;
    const enrolled =
      authenticators?.filter(auth => auth.isEnrolled && !auth.isBackupInterface) || [];
    const countEnrolled = enrolled.length;
    const orgsRequire2fa = organizations?.filter(org => org.require2FA) || [];
    const deleteDisabled = orgsRequire2fa.length > 0 && countEnrolled === 1;
    const hasVerifiedEmail = !!emails?.find(({isVerified}) => isVerified);

    // This happens when you switch between children views and the next child
    // view is lazy loaded, it can potentially be `null` while the code split
    // package is being fetched
    if (!defined(children)) {
      return null;
    }

    return cloneElement(this.props.children, {
      onDisable: this.handleDisable,
      onRegenerateBackupCodes: this.handleRegenerateBackupCodes,
      authenticators,
      deleteDisabled,
      orgsRequire2fa,
      countEnrolled,
      hasVerifiedEmail,
      handleRefresh: this.handleRefresh,
    });
  }
}

export default AccountSecurityWrapper;
