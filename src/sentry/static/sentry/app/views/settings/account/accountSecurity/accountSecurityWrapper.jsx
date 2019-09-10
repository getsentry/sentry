import {withRouter} from 'react-router';
import React from 'react';
import AsyncComponent from 'app/components/asyncComponent';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

const ENDPOINT = '/users/me/authenticators/';

class AccountSecurityWrapper extends AsyncComponent {
  getEndpoints() {
    return [['authenticators', ENDPOINT], ['organizations', '/organizations/']];
  }

  handleDisable = auth => {
    if (!auth || !auth.authId) {
      return;
    }

    this.setState({loading: true});

    this.api
      .requestPromise(`${ENDPOINT}${auth.authId}/`, {method: 'DELETE'})
      .then(this.remountComponent, () => {
        this.setState({loading: false});
        addErrorMessage(t('Error disabling', auth.name));
      });
  };

  handleRegenerateBackupCodes = () => {
    this.setState({loading: true});

    this.api
      .requestPromise(`${ENDPOINT}${this.props.params.authId}/`, {method: 'PUT'})
      .then(this.remountComponent, () =>
        this.addError(t('Error regenerating backup codes'))
      );
  };

  renderBody() {
    const {authenticators, organizations} = this.state;

    const countEnrolled = authenticators.filter(
      auth => auth.isEnrolled && !auth.isBackupInterface
    ).length;
    const orgsRequire2fa = organizations.filter(org => org.require2FA);
    const deleteDisabled = orgsRequire2fa.length > 0 && countEnrolled === 1;

    // This happens when you switch between children views and the next child
    // view is lazy loaded, it can potentially be `null` while the code split
    // package is being fetched
    if (this.props.children === null) {
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

export default withRouter(AccountSecurityWrapper);
