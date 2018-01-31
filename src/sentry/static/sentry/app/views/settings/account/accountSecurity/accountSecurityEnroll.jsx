import {withRouter} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
} from '../../../../actionCreators/settingsIndicator';
import {t} from '../../../../locale';
import AsyncView from '../../../asyncView';
import Button from '../../../../components/buttons/button';
import CircleIndicator from '../../../../components/circleIndicator';
import Confirm from '../../../../components/confirm';
import Form from '../../components/forms/form';
import JsonForm from '../../components/forms/jsonForm';
import PanelItem from '../../components/panelItem';
import Qrcode from '../../../../components/qrcode';
import SettingsPageHeader from '../../components/settingsPageHeader';
import TextBlock from '../../components/text/textBlock';
import U2fsign from '../../../../components/u2fsign';

const ENDPOINT = '/users/me/authenticators/';

const Header = styled.div`
  font-size: 1.2em;
  margin-bottom: 10px;
`;

class AccountSecurityEnroll extends AsyncView {
  constructor(...args) {
    super(...args);
    this._form = {};
  }

  getEndpoints() {
    return [['authenticator', `${ENDPOINT}${this.props.params.authId}/enroll/`]];
  }

  getFields = ({authenticator, hasSentCode} = {}) => {
    let {form, qrcode, challenge, id} = this.state.authenticator;

    if (!form) return null;

    if (qrcode) {
      return [
        () => (
          <PanelItem justify="center" p={2}>
            <Qrcode code={authenticator.qrcode} />
          </PanelItem>
        ),
        ...form,
        () => (
          <PanelItem justify="flex-end" p={2}>
            <Button priority="primary" type="submit">
              {t('Confirm')}
            </Button>
          </PanelItem>
        ),
      ];
    }

    if (id === 'sms') {
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
          <PanelItem justify="flex-end" p={2} pr={'36px'}>
            {hasSentCode && (
              <Button css={{marginRight: 6}} onClick={this.handleSmsReset}>
                {t('Start Over')}
              </Button>
            )}
            <Button priority="primary" type="button" onClick={this.handleSmsSubmit}>
              {hasSentCode ? t('Confirm') : t('Send Code')}
            </Button>
          </PanelItem>
        ),
      ];
    }

    if (id === 'u2f') {
      return [
        ...form,
        () => (
          <U2fsign
            style={{marginBottom: 0}}
            challengeData={challenge}
            displayMode="enroll"
            flowMode="enroll"
            onTap={this.handleU2fTap}
          />
        ),
      ];
    }

    return null;
  };

  handleSmsReset = () => {
    this.setState(
      {
        hasSentCode: false,
      },
      this.remountComponent
    );
  };

  handleSmsSubmit = dataModel => {
    let {authenticator, hasSentCode} = this.state;

    let data = {
      phone: this._form.phone,
      // Send null OTP if we are submitting OTP verification
      // Otherwise API will think that we are on verification step (e.g. after submitting phone)
      otp: hasSentCode ? this._form.otp || '' : undefined,
      // ...((dataModel && dataModel.toJSON()) || {}),
      secret: authenticator.secret,
    };

    // Only show loading when submitting OTP
    this.setState({
      loading: hasSentCode,
    });

    addMessage(`Sending code to ${data.phone}...`);

    this.api
      .requestPromise(`${ENDPOINT}${this.props.params.authId}/enroll/`, {
        data,
      })
      .then(
        () => {
          if (!this.state.hasSentCode) {
            this.setState({
              hasSentCode: true,
              loading: false,
              // authenticator: data,
            });
            addMessage(`Sent code to ${data.phone}`);
          } else {
            this.props.router.push('/settings/account/security/');
            addSuccessMessage(`Added authenticator ${authenticator.name}`);
          }
        },
        error => {
          let isSmsInterface = authenticator.id === 'sms';

          // Re-mount because we want to fetch a fresh secret
          this.remountComponent();

          let errorMessage = this.state.hasSentCode
            ? 'Incorrect OTP'
            : 'Error sending SMS';
          addErrorMessage(errorMessage);

          this.setState({
            hasSentCode: !isSmsInterface,
          });
        }
      );
  };

  handleEnrollSuccess = () => {
    let authenticatorName =
      (this.state.authenticator && this.state.authenticator.name) || 'Authenticator';
    this.props.router.push('/settings/account/security');
    addSuccessMessage(`${authenticatorName} has been added`);
  };

  handleEnrollError = () => {
    let authenticatorName =
      (this.state.authenticator && this.state.authenticator.name) || 'Authenticator';
    addErrorMessage(`Error adding ${authenticatorName} authenticator`);
  };

  handleFieldChange = ({name, value}) => {
    // This should not be used for rendering, that's why it's not in state
    this._form[name] = value;
  };

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

  handleSubmit = dataModel => {
    let {authenticator} = this.state;

    let data = {
      ...this._form,
      ...((dataModel && dataModel.toJSON()) || {}),
      secret: authenticator.secret,
    };

    this.setState({
      loading: true,
    });
    this.api
      .requestPromise(`${ENDPOINT}${this.props.params.authId}/enroll/`, {
        data,
      })
      .then(this.handleSubmitSuccess, this.handleSubmitError);
  };

  handleSubmitSuccess = data => {
    let {authenticator, hasSentCode} = this.state;
    let isSmsInterface = authenticator.id === 'sms';

    if (isSmsInterface && !hasSentCode) {
      this.setState({
        hasSentCode: true,
        loading: false,
        authenticator: data,
      });
    } else {
      this.props.router.push('/settings/account/security/');
      addSuccessMessage(`Added authenticator ${authenticator.name}`);
    }
  };

  handleSubmitError = error => {
    let {authenticator} = this.state;
    let isSmsInterface = authenticator.id === 'sms';

    this.setState({
      hasSentCode: !isSmsInterface,
    });

    // Re-mount because we want to fetch a fresh secret
    this.remountComponent();

    let errorMessage = `Error adding authenticator method ${authenticator.name}`;

    if (isSmsInterface) {
      if (this.state.hasSentCode) {
        errorMessage = 'Incorrect OTP';
      } else {
        errorMessage = 'Error sending SMS';
      }
    }

    addErrorMessage(errorMessage);
  };

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

    let fields = this.getFields({authenticator, hasSentCode: this.state.hasSentCode});

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
            authenticator.removeButton && (
              <Confirm
                onConfirm={this.handleRemove}
                message={
                  <React.Fragment>
                    <Header>{t('Do you want to remove the method?')}</Header>
                    <TextBlock>
                      {t(
                        'You will no longer be able to use it for two-factor authentication afterwards. Removing the last authenticator removes two-factor authentication completely.'
                      )}
                    </TextBlock>
                  </React.Fragment>
                }
              >
                <Button priority="danger" onClick={this.handleRemove}>
                  {authenticator.removeButton}
                </Button>
              </Confirm>
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
              initialData={authenticator}
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
