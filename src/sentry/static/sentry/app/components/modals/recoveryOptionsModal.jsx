import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/buttons/button';
import TextBlock from 'app/views/settings/components/text/textBlock';
import space from 'app/styles/space';

class RecoveryOptionsModal extends AsyncComponent {
  static propTypes = {
    closeModal: PropTypes.func,
    onClose: PropTypes.func,
    authenticatorName: PropTypes.string.isRequired,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      skipSms: false,
    };
  }

  getEndpoints() {
    return [['authenticators', '/users/me/authenticators/']];
  }

  handleSkipSms = () => {
    this.setState({skipSms: true});
  };

  renderBody() {
    let {authenticatorName, closeModal, Body, Header} = this.props;
    let {authenticators, skipSms} = this.state;

    let {recovery, sms} = authenticators.reduce((obj, item) => {
      obj[item.id] = item;
      return obj;
    }, {});

    let smsEnrolled = sms && sms.isEnrolled;
    let recoveryEnrolled = recovery && recovery.isEnrolled;

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Two Factor Authentication Enabled')}
        </Header>

        <Body>
          <TextBlock>
            {t(`Two factor authentication via ${authenticatorName} has been enabled `)}
          </TextBlock>
          <TextBlock>
            {t('You should now set up recovery options to secure your account.')}
          </TextBlock>

          {!skipSms && !smsEnrolled ? (
            // set up backup phone number
            <Alert>
              {t('Do you want to add a phone number as a backup 2FA method?')}
            </Alert>
          ) : (
            // get recovery codes
            <Alert>
              {t(
                `Using a recovery code is the only way to access your account, if you lose your
                   device and cannot receive two factor authentication codes.`
              )}
            </Alert>
          )}
        </Body>

        {!skipSms && !smsEnrolled ? (
          // set up backup phone number
          <div className="modal-footer">
            <Button onClick={this.handleSkipSms} name={'skipStep'} autoFocus>
              {t('Skip this step')}
            </Button>
            <Button
              priority={'primary'}
              to={`/settings/account/security/${sms.id}/enroll/`}
              name={'addPhone'}
              css={{marginLeft: space(1)}}
              autoFocus
            >
              {t('Add a Phone Number')}
            </Button>
          </div>
        ) : (
          // get recovery codes
          <div className="modal-footer">
            <Button
              priority={'primary'}
              to={
                recoveryEnrolled
                  ? `/settings/account/security/${recovery.authId}/`
                  : '/settings/account/security/'
              }
              name={'getCodes'}
              autoFocus
            >
              {t('Get Recovery Codes')}
            </Button>
          </div>
        )}
      </React.Fragment>
    );
  }
}

export default RecoveryOptionsModal;
