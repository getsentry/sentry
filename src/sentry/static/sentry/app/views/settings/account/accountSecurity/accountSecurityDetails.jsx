/**
 * AccountSecurityDetails is only displayed when user is enrolled in the 2fa method.
 * It displays created + last used time of the 2fa method.
 *
 * Also displays 2fa method specific details.
 */
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import DateTime from 'app/components/dateTime';
import RecoveryCodes from 'app/views/settings/account/accountSecurity/components/recoveryCodes';
import RemoveConfirm from 'app/views/settings/account/accountSecurity/components/removeConfirm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Tooltip from 'app/components/tooltip';
import U2fEnrolledDetails from 'app/views/settings/account/accountSecurity/components/u2fEnrolledDetails';
import space from 'app/styles/space';

const ENDPOINT = '/users/me/authenticators/';

class AuthenticatorDate extends React.Component {
  static propTypes = {
    label: PropTypes.string,
    /**
     * Can be null or a Date object.
     * Component will have value "never" if it is null
     */
    date: PropTypes.string,
  };

  render() {
    const {label, date} = this.props;

    return (
      <React.Fragment>
        <DateLabel>{label}</DateLabel>
        <div>{date ? <DateTime date={date} /> : t('never')}</div>
      </React.Fragment>
    );
  }
}

class AccountSecurityDetails extends AsyncView {
  static PropTypes = {
    deleteDisabled: PropTypes.bool.isRequired,
    onRegenerateBackupCodes: PropTypes.func.isRequired,
  };

  _form = {};

  getTitle() {
    return t('Security');
  }

  getEndpoints() {
    return [['authenticator', `${ENDPOINT}${this.props.params.authId}/`]];
  }

  addError(message) {
    this.setState({loading: false});
    addErrorMessage(message);
  }

  handleRemove = device => {
    const {authenticator} = this.state;

    if (!authenticator || !authenticator.authId) {
      return;
    }
    const isRemovingU2fDevice = !!device;
    const deviceId = isRemovingU2fDevice ? `${device.key_handle}/` : '';

    this.setState(
      {
        loading: true,
      },
      () =>
        this.api
          .requestPromise(`${ENDPOINT}${authenticator.authId}/${deviceId}`, {
            method: 'DELETE',
          })
          .then(
            () => {
              this.props.router.push('/settings/account/security');
              const deviceName = isRemovingU2fDevice ? device.name : 'Authenticator';
              addSuccessMessage(t('%s has been removed', deviceName));
            },
            () => {
              // Error deleting authenticator
              const deviceName = isRemovingU2fDevice ? device.name : 'authenticator';
              this.addError(t('Error removing %s', deviceName));
            }
          )
    );
  };

  renderBody() {
    const {authenticator} = this.state;
    const {deleteDisabled, onRegenerateBackupCodes} = this.props;

    return (
      <div>
        <SettingsPageHeader
          title={
            <React.Fragment>
              <span>{authenticator.name}</span>
              <AuthenticatorStatus enabled={authenticator.isEnrolled} />
            </React.Fragment>
          }
          action={
            authenticator.isEnrolled &&
            authenticator.removeButton && (
              <Tooltip
                title={t(
                  "Two-factor authentication is required for at least one organization you're a member of."
                )}
                disabled={!deleteDisabled}
              >
                <RemoveConfirm onConfirm={this.handleRemove} disabled={deleteDisabled}>
                  <Button priority="danger">{authenticator.removeButton}</Button>
                </RemoveConfirm>
              </Tooltip>
            )
          }
        />

        <TextBlock>{authenticator.description}</TextBlock>

        <AuthenticatorDates>
          <AuthenticatorDate label={t('Created at')} date={authenticator.createdAt} />
          <AuthenticatorDate label={t('Last used')} date={authenticator.lastUsedAt} />
        </AuthenticatorDates>

        <U2fEnrolledDetails
          isEnrolled={authenticator.isEnrolled}
          id={authenticator.id}
          devices={authenticator.devices}
          onRemoveU2fDevice={this.handleRemove}
        />

        {authenticator.isEnrolled && authenticator.phone && (
          <PhoneWrapper>
            {t('Confirmation codes are sent to the following phone number')}:
            <Phone>{authenticator.phone}</Phone>
          </PhoneWrapper>
        )}

        <RecoveryCodes
          onRegenerateBackupCodes={onRegenerateBackupCodes}
          isEnrolled={authenticator.isEnrolled}
          codes={authenticator.codes}
        />
      </div>
    );
  }
}

export default AccountSecurityDetails;

const AuthenticatorStatus = styled(CircleIndicator)`
  margin-left: ${space(1)};
`;

const AuthenticatorDates = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: max-content auto;
`;

const DateLabel = styled('span')`
  font-weight: bold;
`;

const PhoneWrapper = styled('div')`
  margin-top: ${space(4)};
`;

const Phone = styled('span')`
  font-weight: bold;
  margin-left: ${space(1)};
`;
