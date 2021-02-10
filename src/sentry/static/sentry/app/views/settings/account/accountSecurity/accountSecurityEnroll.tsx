import React from 'react';
import {RouteComponentProps, withRouter} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {openRecoveryOptions} from 'app/actionCreators/modal';
import {fetchOrganizationByMember} from 'app/actionCreators/organizations';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import {PanelItem} from 'app/components/panels';
import Qrcode from 'app/components/qrcode';
import U2fsign from 'app/components/u2f/u2fsign';
import {t} from 'app/locale';
import {Authenticator} from 'app/types';
import getPendingInvite from 'app/utils/getPendingInvite';
import AsyncView from 'app/views/asyncView';
import RemoveConfirm from 'app/views/settings/account/accountSecurity/components/removeConfirm';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import {FieldObject} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

type getFieldsOpts = {
  authenticator: Authenticator;
  /**
   * Flag to track if totp has been sent
   */
  hasSentCode: boolean;
  /**
   * Flag to track if we are currently sending the otp code
   */
  sendingCode: boolean;
  /**
   * Callback to reset SMS 2fa enrollment
   */
  onSmsReset: () => void;
  /**
   * Callback when u2f device is activated
   */
  onU2fTap: U2fsign['props']['onTap'];
};

/**
 * Retrieve additional form fields (or modify ones) based on 2fa method
 */
const getFields = ({
  authenticator,
  hasSentCode,
  sendingCode,
  onSmsReset,
  onU2fTap,
}: getFieldsOpts): null | FieldObject[] => {
  const {form} = authenticator;

  if (!form) {
    return null;
  }

  if (authenticator.id === 'totp') {
    return [
      () => (
        <PanelItem key="qrcode" justifyContent="center" p={2}>
          <Qrcode code={authenticator.qrcode} />
        </PanelItem>
      ),
      () => (
        <Field key="secret" label={t('Authenticator secret')}>
          <TextCopyInput>{authenticator.secret ?? ''}</TextCopyInput>
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
  if (authenticator.id === 'sms') {
    // Ideally we would have greater flexibility when rendering footer
    return [
      {...form[0], disabled: sendingCode || hasSentCode},
      ...(hasSentCode ? [{...form[1], required: true}] : []),
      () => (
        <PanelItem key="sms-footer" justifyContent="flex-end" p={2} pr="36px">
          {hasSentCode && (
            <Button css={{marginRight: 6}} onClick={onSmsReset}>
              {t('Start Over')}
            </Button>
          )}
          <Button priority="primary" type="submit">
            {hasSentCode ? t('Confirm') : t('Send Code')}
          </Button>
        </PanelItem>
      ),
    ];
  }

  // Need to render device name field + U2f component
  if (authenticator.id === 'u2f') {
    const deviceNameField = form.find(({name}) => name === 'deviceName')!;
    return [
      deviceNameField,
      () => (
        <U2fsign
          key="u2f-enroll"
          style={{marginBottom: 0}}
          challengeData={authenticator.challenge}
          displayMode="enroll"
          onTap={onU2fTap}
        />
      ),
    ];
  }

  return null;
};

type Props = AsyncView['props'] & RouteComponentProps<{authId: string}, {}> & {};

type State = AsyncView['state'] & {
  authenticator: Authenticator | null;
  hasSentCode: boolean;
  sendingCode: boolean;
};

type PendingInvite = ReturnType<typeof getPendingInvite>;

/**
 * Renders necessary forms in order to enroll user in 2fa
 */
class AccountSecurityEnroll extends AsyncView<Props, State> {
  formModel = new FormModel();

  getTitle() {
    return t('Security');
  }

  getDefaultState() {
    return {...super.getDefaultState(), hasSentCode: false};
  }

  get authenticatorEndpoint() {
    return `/users/me/authenticators/${this.props.params.authId}/`;
  }

  get enrollEndpoint() {
    return `${this.authenticatorEndpoint}enroll/`;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const errorHandler = (err: any) => {
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

  pendingInvitation: PendingInvite = null;

  get authenticatorName() {
    return this.state.authenticator?.name ?? 'Authenticator';
  }

  // This resets state so that user can re-enter their phone number again
  handleSmsReset = () => this.setState({hasSentCode: false}, this.remountComponent);

  // Handles SMS authenticators
  handleSmsSubmit = async (dataModel: any) => {
    const {authenticator, hasSentCode} = this.state;
    const {phone, otp} = dataModel;

    // Don't submit if empty
    if (!phone || !authenticator) {
      return;
    }

    const data = {
      phone,
      // Make sure `otp` is undefined if we are submitting OTP verification
      // Otherwise API will think that we are on verification step (e.g. after submitting phone)
      otp: hasSentCode ? otp : undefined,
      secret: authenticator.secret,
    };

    // Only show loading when submitting OTP
    this.setState({sendingCode: !hasSentCode});

    if (!hasSentCode) {
      addLoadingMessage(t('Sending code to %s...', data.phone));
    } else {
      addLoadingMessage(t('Verifying OTP...'));
    }

    try {
      await this.api.requestPromise(this.enrollEndpoint, {data});
    } catch (error) {
      this.formModel.resetForm();

      addErrorMessage(
        this.state.hasSentCode ? t('Incorrect OTP') : t('Error sending SMS')
      );

      this.setState({
        hasSentCode: false,
        sendingCode: false,
      });

      // Re-mount because we want to fetch a fresh secret
      this.remountComponent();

      return;
    }

    if (!hasSentCode) {
      // Just successfully finished sending OTP to user
      this.setState({hasSentCode: true, sendingCode: false});
      addSuccessMessage(t('Sent code to %s', data.phone));
    } else {
      // OTP was accepted and SMS was added as a 2fa method
      this.handleEnrollSuccess();
    }
  };

  // Handle u2f device tap
  handleU2fTap = async (tapData: any) => {
    const data = {...tapData, ...this.formModel.fields.toJS()};

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
  handleTotpSubmit = async (dataModel: any) => {
    if (!this.state.authenticator) {
      return;
    }

    const data = {
      ...(dataModel ?? {}),
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

  handleSubmit: Form['props']['onSubmit'] = data => {
    const id = this.state.authenticator?.id;

    if (id === 'totp') {
      this.handleTotpSubmit(data);
      return;
    }
    if (id === 'sms') {
      this.handleSmsSubmit(data);
      return;
    }
  };

  // Handler when we successfully add a 2fa device
  async handleEnrollSuccess() {
    // If we're pending approval of an invite, the user will have just joined
    // the organization when completing 2fa enrollment. We should reload the
    // organization context in that case to assign them to the org.
    if (this.pendingInvitation) {
      await fetchOrganizationByMember(this.pendingInvitation.memberId.toString(), {
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
    const {authenticator, hasSentCode, sendingCode} = this.state;

    if (!authenticator) {
      return null;
    }

    const fields = getFields({
      authenticator,
      hasSentCode,
      sendingCode,
      onSmsReset: this.handleSmsReset,
      onU2fTap: this.handleU2fTap,
    });

    // Attempt to extract `defaultValue` from server generated form fields
    const defaultValues = fields
      ? fields
          .filter(
            field =>
              typeof field !== 'function' && typeof field.defaultValue !== 'undefined'
          )
          .map(field => [
            field.name,
            typeof field !== 'function' ? field.defaultValue : '',
          ])
          .reduce((acc, [name, value]) => {
            acc[name] = value;
            return acc;
          }, {})
      : {};

    return (
      <React.Fragment>
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

        {!!authenticator.form?.length && (
          <Form
            model={this.formModel}
            apiMethod="POST"
            apiEndpoint={this.authenticatorEndpoint}
            onSubmit={this.handleSubmit}
            initialData={{...defaultValues, ...authenticator}}
            hideFooter
          >
            <JsonForm forms={[{title: 'Configuration', fields: fields ?? []}]} />
          </Form>
        )}
      </React.Fragment>
    );
  }
}

export default withRouter(AccountSecurityEnroll);
