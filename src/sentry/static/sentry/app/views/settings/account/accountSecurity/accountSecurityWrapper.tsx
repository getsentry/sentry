import {RouteComponentProps} from 'react-router/lib/Router';
import * as React from 'react';

import {Authenticator, OrganizationSummary} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';

const ENDPOINT = '/users/me/authenticators/';

type Props = {
  children: React.ReactElement;
} & RouteComponentProps<{authId: string}, {}> &
  AsyncComponent['props'];

type State = {
  authenticators?: Authenticator[] | null;
  organizations?: OrganizationSummary[];
} & AsyncComponent['state'];

class AccountSecurityWrapper extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string][] {
    return [
      ['authenticators', ENDPOINT],
      ['organizations', '/organizations/'],
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

  renderBody() {
    const {children} = this.props;
    const {authenticators, organizations} = this.state;

    const enrolled =
      authenticators?.filter(auth => auth.isEnrolled && !auth.isBackupInterface) || [];
    const countEnrolled = enrolled.length;
    const orgsRequire2fa = organizations?.filter(org => org.require2FA) || [];
    const deleteDisabled = orgsRequire2fa.length > 0 && countEnrolled === 1;

    // This happens when you switch between children views and the next child
    // view is lazy loaded, it can potentially be `null` while the code split
    // package is being fetched
    if (!defined(children)) {
      return null;
    }

    return React.cloneElement(this.props.children, {
      onDisable: this.handleDisable,
      onRegenerateBackupCodes: this.handleRegenerateBackupCodes,
      authenticators,
      deleteDisabled,
      orgsRequire2fa,
      countEnrolled,
    });
  }
}

export default AccountSecurityWrapper;
