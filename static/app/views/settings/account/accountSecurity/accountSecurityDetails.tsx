/**
 * AccountSecurityDetails is only displayed when user is enrolled in the 2fa method.
 * It displays created + last used time of the 2fa method.
 *
 * Also displays 2fa method specific details.
 */
import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import DateTime from 'app/components/dateTime';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Authenticator, AuthenticatorDevice} from 'app/types';
import AsyncView from 'app/views/asyncView';
import RecoveryCodes from 'app/views/settings/account/accountSecurity/components/recoveryCodes';
import RemoveConfirm from 'app/views/settings/account/accountSecurity/components/removeConfirm';
import U2fEnrolledDetails from 'app/views/settings/account/accountSecurity/components/u2fEnrolledDetails';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const ENDPOINT = '/users/me/authenticators/';

type AuthenticatorDateProps = {
  label: string;
  /**
   * Can be null or a Date object.
   * Component will have value "never" if it is null
   */
  date: string | null;
};

function AuthenticatorDate({label, date}: AuthenticatorDateProps) {
  return (
    <React.Fragment>
      <DateLabel>{label}</DateLabel>
      <div>{date ? <DateTime date={date} /> : t('never')}</div>
    </React.Fragment>
  );
}

type Props = {
  deleteDisabled: boolean;
  onRegenerateBackupCodes: () => void;
} & RouteComponentProps<{authId: string}, {}>;

type State = {
  authenticator: Authenticator | null;
} & AsyncView['state'];

class AccountSecurityDetails extends AsyncView<Props, State> {
  getTitle() {
    return t('Security');
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    const {authId} = params;

    return [['authenticator', `${ENDPOINT}${authId}/`]];
  }

  handleRemove = async (device?: AuthenticatorDevice) => {
    const {authenticator} = this.state;

    if (!authenticator || !authenticator.authId) {
      return;
    }

    // if the device is defined, it means that U2f is being removed
    const deviceId = device ? `${device.key_handle}/` : '';
    const deviceName = device ? device.name : t('Authenticator');

    this.setState({loading: true});

    try {
      await this.api.requestPromise(`${ENDPOINT}${authenticator.authId}/${deviceId}`, {
        method: 'DELETE',
      });
      this.props.router.push('/settings/account/security');
      addSuccessMessage(t('%s has been removed', deviceName));
    } catch {
      // Error deleting authenticator
      this.setState({loading: false});
      addErrorMessage(t('Error removing %s', deviceName));
    }
  };

  renderBody() {
    const {authenticator} = this.state;

    if (!authenticator) {
      return null;
    }

    const {deleteDisabled, onRegenerateBackupCodes} = this.props;

    return (
      <React.Fragment>
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
      </React.Fragment>
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
