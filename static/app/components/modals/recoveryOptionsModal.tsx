import {Fragment} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Authenticator} from 'sentry/types';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = DeprecatedAsyncComponent['props'] &
  ModalRenderProps & {
    authenticatorName: string;
  };

type State = DeprecatedAsyncComponent['state'] & {
  authenticators: Authenticator[] | null;
  skipSms: boolean;
};

class RecoveryOptionsModal extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState() {
    return {...super.getDefaultState(), skipSms: false};
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [['authenticators', '/users/me/authenticators/']];
  }

  handleSkipSms = () => {
    this.setState({skipSms: true});
  };

  renderBody() {
    const {authenticatorName, closeModal, Body, Header, Footer} = this.props;
    const {authenticators, skipSms} = this.state;

    const {recovery, sms} = authenticators!.reduce<{[key: string]: Authenticator}>(
      (obj, item) => {
        obj[item.id] = item;
        return obj;
      },
      {}
    );
    const recoveryEnrolled = recovery && recovery.isEnrolled;
    const displaySmsPrompt =
      sms && !sms.isEnrolled && !skipSms && !sms.disallowNewEnrollment;

    return (
      <Fragment>
        <Header closeButton>{t('Two-Factor Authentication Enabled')}</Header>

        <Body>
          <TextBlock>
            {t('Two-factor authentication via %s has been enabled.', authenticatorName)}
          </TextBlock>
          <TextBlock>
            {t('You should now set up recovery options to secure your account.')}
          </TextBlock>

          {displaySmsPrompt ? (
            // set up backup phone number
            <Alert type="warning">
              {t('We recommend adding a phone number as a backup 2FA method.')}
            </Alert>
          ) : (
            // get recovery codes
            <Alert type="warning">
              {t(
                `Recovery codes are the only way to access your account if you lose
                  your device and cannot receive two-factor authentication codes.`
              )}
            </Alert>
          )}
        </Body>

        {displaySmsPrompt ? (
          // set up backup phone number
          <Footer>
            <Button onClick={this.handleSkipSms} name="skipStep" autoFocus>
              {t('Skip this step')}
            </Button>
            <Button
              priority="primary"
              onClick={closeModal}
              to={`/settings/account/security/mfa/${sms.id}/enroll/`}
              name="addPhone"
              css={{marginLeft: space(1)}}
              autoFocus
            >
              {t('Add a Phone Number')}
            </Button>
          </Footer>
        ) : (
          // get recovery codes
          <Footer>
            <Button
              priority="primary"
              onClick={closeModal}
              to={
                recoveryEnrolled
                  ? `/settings/account/security/mfa/${recovery.authId}/`
                  : '/settings/account/security/'
              }
              name="getCodes"
              autoFocus
            >
              {t('Get Recovery Codes')}
            </Button>
          </Footer>
        )}
      </Fragment>
    );
  }
}

export default RecoveryOptionsModal;
