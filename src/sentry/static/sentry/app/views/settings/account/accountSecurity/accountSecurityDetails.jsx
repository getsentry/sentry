/**
 * AccountSecurityDetails is only displayed when user is enrolled in the 2fa method.
 * It displays created + last used time of the 2fa method.
 *
 * Also displays 2fa method specific details.
 */
import {Box, Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import CircleIndicator from 'app/components/circleIndicator';
import DateTime from 'app/components/dateTime';
import RecoveryCodes from 'app/views/settings/account/accountSecurity/components/recoveryCodes';
import RemoveConfirm from 'app/views/settings/account/accountSecurity/components/removeConfirm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import U2fEnrolledDetails from 'app/views/settings/account/accountSecurity/components/u2fEnrolledDetails';

const ENDPOINT = '/users/me/authenticators/';

const DateLabel = styled.span`
  font-weight: bold;
  margin-right: 6px;
  width: 100px;
`;

const Phone = styled.span`
  font-weight: bold;
  margin-left: 6px;
`;

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
    let {label, date} = this.props;

    return (
      <Flex mb={1}>
        <DateLabel>{label}</DateLabel>
        <Box flex="1">{date ? <DateTime date={date} /> : t('never')}</Box>
      </Flex>
    );
  }
}

class AccountSecurityDetails extends AsyncView {
  static PropTypes = {
    deleteDisabled: PropTypes.bool.isRequired,
    handleRegenerateBackupCodes: PropTypes.func.isRequired,
  };
  constructor(...args) {
    super(...args);
    this._form = {};
  }

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
    let {authenticator} = this.state;

    if (!authenticator || !authenticator.authId) return;
    let isRemovingU2fDevice = !!device;
    let deviceId = isRemovingU2fDevice ? `${device.key_handle}/` : '';

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
              let deviceName = isRemovingU2fDevice ? device.name : 'Authenticator';
              addSuccessMessage(t('%s has been removed', deviceName));
            },
            () => {
              // Error deleting authenticator
              let deviceName = isRemovingU2fDevice ? device.name : 'authenticator';
              this.addError(t('Error removing %s', deviceName));
            }
          )
    );
  };

  handleRemoveU2fDevice = () => {
    // TODO(billy): Implement me
  };

  renderBody() {
    let {authenticator} = this.state;
    let {deleteDisabled, handleRegenerateBackupCodes} = this.props;

    return (
      <div>
        <SettingsPageHeader
          title={
            <React.Fragment>
              <span>{authenticator.name}</span>
              <CircleIndicator css={{marginLeft: 6}} enabled={authenticator.isEnrolled} />
            </React.Fragment>
          }
          action={
            authenticator.isEnrolled &&
            authenticator.removeButton && (
              <RemoveConfirm onConfirm={this.handleRemove} disabled={deleteDisabled}>
                <Button priority="danger">{authenticator.removeButton}</Button>
              </RemoveConfirm>
            )
          }
        />

        <TextBlock>{authenticator.description}</TextBlock>
        <AuthenticatorDate label={t('Created at')} date={authenticator.createdAt} />
        <AuthenticatorDate label={t('Last used')} date={authenticator.lastUsedAt} />

        <U2fEnrolledDetails
          isEnrolled={authenticator.isEnrolled}
          id={authenticator.id}
          devices={authenticator.devices}
          onRemoveU2fDevice={this.handleRemove}
        />

        {authenticator.isEnrolled &&
          authenticator.phone && (
            <div css={{marginTop: 30}}>
              {t('Confirmation codes are sent to the following phone number')}:
              <Phone>{authenticator.phone}</Phone>
            </div>
          )}

        <RecoveryCodes
          onRegenerateBackupCodes={handleRegenerateBackupCodes}
          isEnrolled={authenticator.isEnrolled}
          codes={authenticator.codes}
        />
      </div>
    );
  }
}

export default withRouter(AccountSecurityDetails);
