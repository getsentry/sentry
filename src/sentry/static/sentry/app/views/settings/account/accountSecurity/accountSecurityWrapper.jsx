import React from 'react';
import AsyncView from 'app/views/asyncView';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

const ENDPOINT = '/users/me/authenticators/';

class AccountSecurityWrapper extends AsyncView {
  getEndpoints() {
    return [['authenticators', ENDPOINT], ['organizations', '/organizations/']];
  }

  handleDisable = auth => {
    if (!auth || !auth.authId) return;

    this.setState(
      {
        loading: true,
      },
      () =>
        this.api
          .requestPromise(`${ENDPOINT}${auth.authId}/`, {
            method: 'DELETE',
          })
          .then(this.remountComponent, () => {
            this.setState({loading: false});
            addErrorMessage(t('Error disabling', auth.name));
          })
    );
  };

  renderBody() {
    let {authenticators, organizations} = this.state;

    let countEnrolled = authenticators.filter(
      auth => auth.isEnrolled && !auth.isBackupInterface
    ).length;
    let orgsRequire2fa = organizations.filter(org => org.require2FA);
    let deleteDisabled = orgsRequire2fa.length > 0 && countEnrolled === 1;

    return React.cloneElement(this.props.children, {
      handleDisable: this.handleDisable.bind(this),
      authenticators,
      deleteDisabled,
      orgsRequire2fa,
      countEnrolled,
    });
  }
}

export default AccountSecurityWrapper;
