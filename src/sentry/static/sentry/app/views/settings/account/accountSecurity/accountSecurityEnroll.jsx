import {withRouter} from 'react-router';
import {Fragment} from 'react';

import {PanelItem} from 'app/components/panels';
import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {openRecoveryOptions} from 'app/actionCreators/modal';
import {fetchOrganizationByMember} from 'app/actionCreators/organizations';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Qrcode from 'app/components/qrcode';
import RemoveConfirm from 'app/views/settings/account/accountSecurity/components/removeConfirm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import U2fsign from 'app/components/u2f/u2fsign';
import getPendingInvite from 'app/utils/getPendingInvite';

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
  const {form, qrcode, challenge, id} = authenticator || {};

  if (!form) {
    return null;
  }

  if (qrcode) {
    return [
      () => (
        <PanelItem key="qrcode" justifyContent="center" p={2}>
          <Qrcode code={authenticator.qrcode} />
        </PanelItem>
      ),
      () => (
        <Field key="secret" label={t('Authenticator secret')}>
          <TextCopyInput>{authenticator.secret}</TextCopyInput>
        </Field>
      ),
      ...form,
      () => (
        <PanelItem key="confirm" justifyContent="flex-end" p={2}>
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
        <PanelItem key="sms-footer" justifyContent="flex-end" p={2} pr="36px">
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
    const deviceNameField = form.find(({name}) => name === 'deviceName');
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

/**
 * Renders necessary forms in order to enroll user in 2fa
 */
class AccountSecurityEnroll extends AsyncView {
  _form = {};

  getTitle() {
    return t('Security');
  }

  get authenticatorEndpoint() {
    return `/users/me/authenticators/${this.props.params.authId}/`;
  }

  get enrollEndpoint() {
    return `${this.authenticatorEndpoint}enroll/`;
  }

  getEndpoints() {
    const errorHandler = err => {
      const alreadyEnrolled =
        err &&
        err.status === 400 &&
        err.responseJSON &&
        err.responseJSON.details === 'Already enrolled';

      if (alreadyEnrolled) {
        this.props.router.push('/settings/account/security/');
        addErrorMessage(t('Already enrolled'));
      }

      // Allow the endpoint to fail if the user is already enrolled
      return alreadyEnrolled;
    };

    return [['authenticator', this.enrollEndpoint, {}, {allowError: errorHandler}]];
  }

  componentDidMount() {
    this.pendingInvitation = getPendingInvite();
  }

  get authenticatorName() {
    const {authenticator} = this.state;
    return (authenticator && authenticator.name) || 'Authenticator';
  }

  handleFieldChange = (name, value) => {
    // This should not be used for rendering, that's why it's not in state
    this._form[name] = value;
  };

  // This resets state so that user can re-enter their phone number again
  handleSmsReset = () => this.setState({hasSentCode: false}, this.remountComponent);

  // Handles SMS authenticators
  handleSmsSubmit = async () => {
    const {authenticator, hasSentCode} = this.state;

    // Don't submit if empty
    if (!this._form.phone) {
      return;
    }

    const data = {
      phone: this._form.phone,
      // Make sure `otp` is undefined if we are submitting OTP verification
      // Otherwise API will think that we are on verification step (e.g. after submitting phone)
      otp: hasSentCode ? this._form.otp || '' : undefined,
      secret: authenticator.secret,
    };

    // Only show loading when submitting OTP
    this.setState({loading: hasSentCode});

    if (!hasSentCode) {
      addMessage(t('Sending code to %s...', data.phone));
    }

    try {
      await this.api.requestPromise(this.enrollEndpoint, {data});
    } catch (error) {
      this._form = {};
      const isSmsInterface = authenticator.id === 'sms';

      this.setState({
        hasSentCode: !isSmsInterface,
      });

      // Re-mount because we want to fetch a fresh secret
      this.remountComponent();

      addErrorMessage(
        this.state.hasSentCode ? t('Incorrect OTP') : t('Error sending SMS')
      );

      return;
    }

    if (!hasSentCode) {
      // Just successfully finished sending OTP to user
      this.setState({hasSentCode: true, loading: false});
      addMessage(t('Sent code to %s', data.phone));
    } else {
      // OTP was accepted and SMS was added as a 2fa method
      this.handleEnrollSuccess();
    }
  };

  // Handle u2f device tap
  handleU2fTap = async tapData => {
    const data = {...tapData, ...this._form};

    this.setState({loading: true});

    try {
      await this.api.requestPromise(this.enrollEndpoint, {data});
    } catch (err) {
      this.handleEnrollError();
      return;
    }

    this.handleEnrollSuccess();
  };

  // Currently only TOTP uses this
  handleTotpSubmit = async dataModel => {
    const data = {
      ...this._form,
      ...(dataModel || {}),
      secret: this.state.authenticator.secret,
    };

    this.setState({loading: true});

    try {
      await this.api.requestPromise(this.enrollEndpoint, {method: 'POST', data});
    } catch (err) {
      this.handleEnrollError();
      return;
    }

    this.handleEnrollSuccess();
  };

  // Handler when we successfully add a 2fa device
  async handleEnrollSuccess() {
    // If we're pending approval of an invite, the user will have just joined
    // the organization when completing 2fa enrollment. We should reload the
    // organization context in that case to assign them to the org.
    if (this.pendingInvitation) {
      await fetchOrganizationByMember(this.pendingInvitation.memberId, {
        addOrg: true,
        fetchOrgDetails: true,
      });
    }

    this.props.router.push('/settings/account/security/');
    openRecoveryOptions({authenticatorName: this.authenticatorName});
  }

  // Handler when we failed to add a 2fa device
  handleEnrollError() {
    this.setState({loading: false});
    addErrorMessage(t('Error adding %s authenticator', this.authenticatorName));
  }

  // Removes an authenticator
  handleRemove = async () => {
    const {authenticator} = this.state;

    if (!authenticator || !authenticator.authId) {
      return;
    }

    // `authenticator.authId` is NOT the same as `props.params.authId` This is
    // for backwards compatability with API endpoint
    try {
      await this.api.requestPromise(this.authenticatorEndpoint, {method: 'DELETE'});
    } catch (err) {
      addErrorMessage(t('Error removing authenticator'));
      return;
    }

    this.props.router.push('/settings/account/security/');
    addSuccessMessage(t('Authenticator has been removed'));
  };

  renderBody() {
    const {authenticator, hasSentCode} = this.state;

    if (!authenticator) {
      return null;
    }

    const fields = getFields({
      authenticator,
      hasSentCode,
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
      <Fragment>
        <SettingsPageHeader
          title={
            <Fragment>
              <span>{authenticator.name}</span>
              <CircleIndicator css={{marginLeft: 6}} enabled={authenticator.isEnrolled} />
            </Fragment>
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

        {authenticator.form && !!authenticator.form.length && (
          <Form
            apiMethod="POST"
            onFieldChange={this.handleFieldChange}
            apiEndpoint={this.authenticatorEndpoint}
            onSubmit={this.handleTotpSubmit}
            initialData={{...defaultValues, ...authenticator}}
            hideFooter
          >
            <JsonForm forms={[{title: 'Configuration', fields}]} />
          </Form>
        )}
      </Fragment>
    );
  }
}

export default withRouter(AccountSecurityEnroll);
