import React from 'react';
import AsyncView from 'app/views/asyncView';

class AccountSecurityWrapper extends AsyncView {
  getEndpoints() {
    return [
      ['authenticators', '/users/me/authenticators/'],
      ['organizations', '/organizations/'],
    ];
  }

  renderBody() {
    let {authenticators, organizations} = this.state;

    let countEnrolled = authenticators.filter(
      auth => auth.isEnrolled && !auth.isBackupInterface
    ).length;
    let orgsRequire2fa = organizations.filter(org => org.require2FA);
    let deleteDisabled = orgsRequire2fa.length > 0 && countEnrolled === 1;

    return React.cloneElement(this.props.children, {
      remountParent: this.remountComponent.bind(this),
      authenticators,
      deleteDisabled,
      orgsRequire2fa,
      countEnrolled,
    });
  }
}

export default AccountSecurityWrapper;
