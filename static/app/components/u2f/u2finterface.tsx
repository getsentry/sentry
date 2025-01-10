import {Component} from 'react';
import * as Sentry from '@sentry/react';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'cbor... Remove this comment to see the full error message
import * as cbor from 'cbor-web';

import {base64urlToBuffer, bufferToBase64url} from 'sentry/components/u2f/webAuthnHelper';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {ChallengeData} from 'sentry/types/auth';

type TapParams = {
  challenge: string;
  response: string;
  isSuperuserModal?: boolean;
  superuserAccessCategory?: string;
  superuserReason?: string;
};

type Props = {
  challengeData: ChallengeData;
  flowMode: string;
  onTap: ({
    response,
    challenge,
    isSuperuserModal,
    superuserAccessCategory,
    superuserReason,
  }: TapParams) => Promise<void>;
  silentIfUnsupported: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

type State = {
  challengeElement: HTMLInputElement | null;
  deviceFailure: string | null;
  failCount: number;
  formElement: HTMLFormElement | null;
  hasBeenTapped: boolean;
  isSafari: boolean;
  isSupported: boolean | null;
  responseElement: HTMLInputElement | null;
};

class U2fInterface extends Component<Props, State> {
  state: State = {
    isSupported: null,
    formElement: null,
    challengeElement: null,
    hasBeenTapped: false,
    deviceFailure: null,
    responseElement: null,
    isSafari: false,
    failCount: 0,
  };

  componentDidMount() {
    const supported = !!window.PublicKeyCredential;

    this.setState({isSupported: supported});

    const isSafari =
      navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');

    if (isSafari) {
      this.setState({
        deviceFailure: 'safari: requires interaction',
        isSafari,
        hasBeenTapped: false,
      });
    }

    if (supported && !isSafari) {
      this.invokeU2fFlow();
    }
  }

  getU2FResponse(data: any) {
    if (!data.response) {
      return JSON.stringify(data);
    }

    if (this.props.flowMode === 'sign') {
      const authenticatorData = {
        keyHandle: data.id,
        clientData: bufferToBase64url(data.response.clientDataJSON),
        signatureData: bufferToBase64url(data.response.signature),
        authenticatorData: bufferToBase64url(data.response.authenticatorData),
      };
      return JSON.stringify(authenticatorData);
    }
    if (this.props.flowMode === 'enroll') {
      const authenticatorData = {
        id: data.id,
        rawId: bufferToBase64url(data.rawId),
        response: {
          attestationObject: bufferToBase64url(data.response.attestationObject),
          clientDataJSON: bufferToBase64url(data.response.clientDataJSON),
        },
        type: bufferToBase64url(data.type),
      };
      return JSON.stringify(authenticatorData);
    }

    throw new Error(`Unsupported flow mode '${this.props.flowMode}'`);
  }

  submitU2fResponse(promise: any) {
    promise
      .then((data: any) => {
        this.setState(
          {
            hasBeenTapped: true,
          },
          () => {
            const u2fResponse = this.getU2FResponse(data);
            const challenge = JSON.stringify(this.props.challengeData);

            if (this.state.responseElement) {
              // eslint-disable-next-line react/no-direct-mutation-state
              this.state.responseElement.value = u2fResponse;
            }

            if (!this.props.onTap) {
              this.state.formElement?.submit();
              return;
            }

            this.props
              .onTap({
                response: u2fResponse,
                challenge,
              })
              .catch(() => {
                // This is kind of gross but I want to limit the amount of changes to this component
                this.setState({
                  deviceFailure: 'UNKNOWN_ERROR',
                  hasBeenTapped: false,
                });
              });
          }
        );
      })
      .catch((err: any) => {
        let failure = 'DEVICE_ERROR';
        // in some rare cases there is no metadata on the error which
        // causes this to blow up badly.
        if (err.metaData) {
          if (err.metaData.type === 'DEVICE_INELIGIBLE') {
            if (this.props.flowMode === 'enroll') {
              failure = 'DUPLICATE_DEVICE';
            } else {
              failure = 'UNKNOWN_DEVICE';
            }
          } else if (err.metaData.type === 'BAD_REQUEST') {
            failure = 'BAD_APPID';
          }
        }
        // we want to know what is happening here.  There are some indicators
        // that users are getting errors that should not happen through the
        // regular u2f flow.
        Sentry.captureException(err);
        this.setState({
          deviceFailure: failure,
          hasBeenTapped: false,
          failCount: this.state.failCount + 1,
        });
      });
  }

  webAuthnSignIn(publicKeyCredentialRequestOptions: any) {
    const promise = navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });
    this.submitU2fResponse(promise);
  }

  webAuthnRegister(publicKey: any) {
    const promise = navigator.credentials.create({
      publicKey,
    });
    this.submitU2fResponse(promise);
  }

  invokeU2fFlow() {
    if (this.props.flowMode === 'sign') {
      const challengeArray = base64urlToBuffer(
        this.props.challengeData.webAuthnAuthenticationData
      );
      const challenge = cbor.decodeFirst(challengeArray);
      challenge
        .then((data: any) => {
          this.webAuthnSignIn(data);
        })
        .catch((err: any) => {
          const failure = 'DEVICE_ERROR';
          Sentry.captureException(err);
          this.setState({
            deviceFailure: failure,
            hasBeenTapped: false,
          });
        });
    } else if (this.props.flowMode === 'enroll') {
      const challengeArray = base64urlToBuffer(
        this.props.challengeData.webAuthnRegisterData
      );
      const challenge = cbor.decodeFirst(challengeArray);
      // challenge contains a PublicKeyCredentialRequestOptions object for webauthn registration
      challenge
        .then((data: any) => {
          this.webAuthnRegister(data.publicKey);
        })
        .catch((err: any) => {
          const failure = 'DEVICE_ERROR';
          Sentry.captureException(err);
          this.setState({
            deviceFailure: failure,
            hasBeenTapped: false,
          });
        });
    } else {
      throw new Error(`Unsupported flow mode '${this.props.flowMode}'`);
    }
  }

  onTryAgain = () => {
    this.setState(
      {hasBeenTapped: false, deviceFailure: null},
      () => void this.invokeU2fFlow()
    );
  };

  bindChallengeElement: React.RefCallback<HTMLInputElement> = ref => {
    this.setState({
      challengeElement: ref,
      formElement: ref?.form ?? null,
    });

    if (ref) {
      ref.value = JSON.stringify(this.props.challengeData);
    }
  };

  bindResponseElement: React.RefCallback<HTMLInputElement> = ref =>
    this.setState({responseElement: ref});

  renderUnsupported() {
    return this.props.silentIfUnsupported ? null : (
      <div className="u2f-box">
        <div className="inner">
          <p className="error">
            {t(
              `
             Unfortunately your browser does not support U2F. You need to use
             a different two-factor method or switch to a browser that supports
             it (Google Chrome or Microsoft Edge).`
            )}
          </p>
        </div>
      </div>
    );
  }

  get canTryAgain() {
    return this.state.deviceFailure !== 'BAD_APPID';
  }

  renderSafariWebAuthn = () => {
    return (
      <a onClick={this.onTryAgain} className="btn btn-primary">
        {this.props.flowMode === 'enroll'
          ? t('Enroll with WebAuthn')
          : t('Sign in with WebAuthn')}
      </a>
    );
  };

  renderFailure = () => {
    const {deviceFailure} = this.state;
    const supportMail = ConfigStore.get('supportEmail');
    const support = supportMail ? (
      <a href={'mailto:' + supportMail}>{supportMail}</a>
    ) : (
      <span>{t('Support')}</span>
    );
    if (this.state.isSafari && this.state.failCount === 0) {
      return this.renderSafariWebAuthn();
    }
    return (
      <div className="failure-message">
        <div>
          <strong>{t('Error: ')}</strong>{' '}
          {
            {
              UNKNOWN_ERROR: t('There was an unknown problem, please try again'),
              DEVICE_ERROR: t('Your U2F device reported an error.'),
              DUPLICATE_DEVICE: t('This device is already registered with Sentry.'),
              UNKNOWN_DEVICE: t('The device you used for sign-in is unknown.'),
              BAD_APPID: tct(
                `[p1:The Sentry server administrator modified the device
                 registrations.] [p2:You need to remove and re-add the device to continue using
                 your U2F device. Use a different sign-in method or contact [support] for
                 assistance.]`,
                {
                  p1: <p />,
                  p2: <p />,
                  support,
                }
              ),
            }[deviceFailure || '']
          }
        </div>
        {this.canTryAgain && (
          <div style={{marginTop: 18}}>
            <a onClick={this.onTryAgain} className="btn btn-primary">
              {t('Try Again')}
            </a>
          </div>
        )}
      </div>
    );
  };

  renderBody() {
    return this.state.deviceFailure ? this.renderFailure() : this.props.children;
  }

  renderPrompt() {
    const {style} = this.props;

    return (
      <div
        style={style}
        className={
          'u2f-box' +
          (this.state.hasBeenTapped ? ' tapped' : '') +
          (this.state.deviceFailure
            ? this.state.failCount === 0 && this.state.isSafari
              ? ' loading-dots'
              : ' device-failure'
            : '')
        }
      >
        <div className="device-animation-frame">
          <div className="device-failed" />
          <div className="device-animation" />
          <div className="loading-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
        <input type="hidden" name="challenge" ref={this.bindChallengeElement} />
        <input type="hidden" name="response" ref={this.bindResponseElement} />
        <div className="inner">{this.renderBody()}</div>
      </div>
    );
  }

  render() {
    const {isSupported} = this.state;
    // if we are still waiting for the browser to tell us if we can do u2f this
    // will be null.
    if (isSupported === null) {
      return null;
    }

    if (!isSupported) {
      return this.renderUnsupported();
    }

    return this.renderPrompt();
  }
}

export default U2fInterface;
