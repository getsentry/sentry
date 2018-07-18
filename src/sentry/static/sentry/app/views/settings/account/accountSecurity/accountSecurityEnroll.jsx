/**
 * Renders necessary forms in order to enroll user in 2fa
 */
import {withRouter} from 'react-router';
import React from 'react';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {openRecoveryOptions} from 'app/actionCreators/modal';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import CircleIndicator from 'app/components/circleIndicator';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {PanelItem} from 'app/components/panels';
import Qrcode from 'app/components/qrcode';
import RemoveConfirm from 'app/views/settings/account/accountSecurity/components/removeConfirm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import U2fsign from 'app/components/u2fsign';

const ENDPOINT = '/users/me/authenticators/';

/**
 * Retrieve additional form fields (or modify ones) based on 2fa method
 *
 * @param {object} params Params object
 * @param {object} authenticator Authenticator model
 * @param {boolean} hasSentCode Flag to track if totp has been sent
 * @param {function} onSmsReset Callback to reset SMS 2fa enrollment
 * @param {function} onSmsSubmit Callback to handle sending code or submit OTP
 * @param {function} onU2fTap Callback when u2f device is activated
 */
const getFields = ({authenticator, hasSentCode, onSmsReset, onSmsSubmit, onU2fTap}) => {
  let {form, qrcode, challenge, id} = authenticator || {};

  if (!form) return null;

  if (qrcode) {
    return [
      () => (
        <PanelItem key="qrcode" justify="center" p={2}>
          <Qrcode code={authenticator.qrcode} />
        </PanelItem>
      ),
      ...form,
      () => (
        <PanelItem key="confirm" justify="flex-end" p={2}>
          <Button priority="primary" type="submit">
            {t('Confirm')}
          </Button>
        </PanelItem>
      ),
    ];
  }

  // Sms Form needs a start over button + confirm button
  // Also inputs being disabled vary based on hasSentCode
  if (id === 'sms') {
    // Ideally we would have greater flexibility when rendering footer
    return [
      {
        ...form[0],
        disabled: () => hasSentCode,
      },
      {
        ...form[1],
        required: true,
        visible: () => hasSentCode,
      },
      () => (
        <PanelItem key="sms-footer" justify="flex-end" p={2} pr={'36px'}>
          {hasSentCode && (
            <Button css={{marginRight: 6}} onClick={onSmsReset}>
              {t('Start Over')}
            </Button>
          )}
          <Button priority="primary" type="button" onClick={onSmsSubmit}>
            {hasSentCode ? t('Confirm') : t('Send Code')}
          </Button>
        </PanelItem>
      ),
    ];
  }

  // Need to render device name field + U2f component
  if (id === 'u2f') {
    let deviceNameField = form.find(({name}) => name === 'deviceName');
    return [
      deviceNameField,
      () => (
        <U2fsign
          key="u2f-enroll"
          style={{marginBottom: 0}}
          challengeData={challenge}
          displayMode="enroll"
          flowMode="enroll"
          onTap={onU2fTap}
        />
      ),
    ];
  }

  return null;
};

class AccountSecurityEnroll extends AsyncView {
  constructor(...args) {
    super(...args);
    this._form = {};
  }

  getTitle() {
    return t('Security');
  }

  getEndpoints() {
    return [['authenticator', `${ENDPOINT}${this.props.params.authId}/enroll/`]];
  }

  handleFieldChange = (name, value) => {
    // This should not be used for rendering, that's why it's not in state
    this._form[name] = value;
  };

  // This resets state so that user can re-enter their phone number again
  handleSmsReset = () => {
    this.setState(
      {
        hasSentCode: false,
      },
      this.remountComponent
    );
  };

  // Handles
  handleSmsSubmit = dataModel => {
    let {authenticator, hasSentCode} = this.state;

    // Don't submit if empty
    if (!this._form.phone) return;

    let data = {
      phone: this._form.phone,
      // Make sure `otp` is undefined if we are submitting OTP verification
      // Otherwise API will think that we are on verification step (e.g. after submitting phone)
      otp: hasSentCode ? this._form.otp || '' : undefined,
      secret: authenticator.secret,
    };

    // Only show loading when submitting OTP
    this.setState({
      loading: hasSentCode,
    });

    if (!hasSentCode) {
      addMessage(t('Sending code to %s...', data.phone));
    }

    this.api
      .requestPromise(`${ENDPOINT}${this.props.params.authId}/enroll/`, {
        data,
      })
      .then(
        () => {
          if (!hasSentCode) {
            // Just successfully finished sending OTP to user
            this.setState({
              hasSentCode: true,
              loading: false,
              // authenticator: data,
            });
            addMessage(t('Sent code to %s', data.phone));
          } else {
            // OTP was accepted and SMS was added as a 2fa method
            this.props.router.push('/settings/account/security/');
            openRecoveryOptions({
              authenticatorName: authenticator.name,
            });
          }
        },
        error => {
          this._form = {};
          let isSmsInterface = authenticator.id === 'sms';

          this.setState({
            hasSentCode: !isSmsInterface,
          });

          // Re-mount because we want to fetch a fresh secret
          this.remountComponent();

          let errorMessage = this.state.hasSentCode
            ? t('Incorrect OTP')
            : t('Error sending SMS');
          addErrorMessage(errorMessage);
        }
      );
  };

  // Handle u2f device tap
  handleU2fTap = data => {
    return this.api
      .requestPromise(`${ENDPOINT}${this.props.params.authId}/enroll/`, {
        data: {
          ...data,
          ...this._form,
        },
      })
      .then(this.handleEnrollSuccess, this.handleEnrollError);
  };

  // Currently only TOTP uses this
  handleSubmit = dataModel => {
    let {authenticator} = this.state;

    let data = {
      ...this._form,
      ...(dataModel || {}),
      secret: authenticator.secret,
    };

    this.setState({
      loading: true,
    });
    this.api
      .requestPromise(`${ENDPOINT}${this.props.params.authId}/enroll/`, {
        method: 'POST',
        data,
      })
      .then(this.handleEnrollSuccess, this.handleEnrollError);
  };

  // Handler when we successfully add a 2fa device
  handleEnrollSuccess = () => {
    let authenticatorName =
      (this.state.authenticator && this.state.authenticator.name) || 'Authenticator';
    this.props.router.push('/settings/account/security');
    openRecoveryOptions({
      authenticatorName,
    });
  };

  // Handler when we failed to add a 2fa device
  handleEnrollError = () => {
    let authenticatorName =
      (this.state.authenticator && this.state.authenticator.name) || 'Authenticator';
    this.setState({loading: false});
    addErrorMessage(t('Error adding %s authenticator', authenticatorName));
  };

  // Removes an authenticator
  handleRemove = () => {
    let {authenticator} = this.state;

    if (!authenticator || !authenticator.authId) return;

    // `authenticator.authId` is NOT the same as `props.params.authId`
    // This is for backwards compatbility with API endpoint
    this.api
      .requestPromise(`${ENDPOINT}${authenticator.authId}/`, {
        method: 'DELETE',
      })
      .then(
        () => {
          this.props.router.push('/settings/account/security/');
          addSuccessMessage(t('Authenticator has been removed'));
        },
        () => {
          // Error deleting authenticator
          addErrorMessage(t('Error removing authenticator'));
        }
      );
  };

  renderBody() {
    let {authenticator} = this.state;
    let endpoint = `${ENDPOINT}${this.props.params.authId}/`;

    let fields = getFields({
      authenticator,
      hasSentCode: this.state.hasSentCode,
      onSmsReset: this.handleSmsReset,
      onSmsSubmit: this.handleSmsSubmit,
      onU2fTap: this.handleU2fTap,
    });

    // Attempt to extract `defaultValue` from server generated form fields
    const defaultValues = fields
      ? fields
          .filter(field => typeof field.defaultValue !== 'undefined')
          .map(field => [field.name, field.defaultValue])
          .reduce((acc, [name, value]) => {
            acc[name] = value;
            return acc;
          }, {})
      : {};

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
              <RemoveConfirm onConfirm={this.handleRemove}>
                <Button priority="danger">{authenticator.removeButton}</Button>
              </RemoveConfirm>
            )
          }
        />

        <TextBlock>{authenticator.description}</TextBlock>

        {authenticator.form &&
          !!authenticator.form.length && (
            <Form
              apiMethod="POST"
              onFieldChange={this.handleFieldChange}
              apiEndpoint={endpoint}
              onSubmit={this.handleSubmit}
              initialData={{...defaultValues, ...authenticator}}
              hideFooter
            >
              <JsonForm {...this.props} forms={[{title: 'Configuration', fields}]} />
            </Form>
          )}
      </div>
    );
  }
}

export default withRouter(AccountSecurityEnroll);
