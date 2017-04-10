import React from 'react';
import u2f from 'u2f-api';
import ConfigStore from '../stores/configStore';

import {t, tct} from '../locale';

const U2fInterface = React.createClass({
  propTypes: {
    challengeData: React.PropTypes.object.isRequired,
    flowMode: React.PropTypes.string.isRequired,
    onTap: React.PropTypes.func,
    silentIfUnsupported: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      silentIfUnsupported: false
    };
  },

  getInitialState() {
    return {
      isSupported: null,
      formElement: null,
      challengeElement: null,
      hasBeenTapped: false,
      deviceFailure: null,
      responseElement: null
    };
  },

  componentDidMount() {
    u2f.isSupported().then((supported) => {
      this.setState({
        isSupported: supported
      });
      if (!supported) {
        return;
      }
      this.invokeU2fFlow();
    });
  },

  onTryAgain() {
    this.setState({
      hasBeenTapped: false,
      deviceFailure: null,
    }, () => {
      this.invokeU2fFlow();
    });
  },

  invokeU2fFlow() {
    let promise;
    if (this.props.flowMode === 'sign') {
      promise = u2f.sign(this.props.challengeData.authenticateRequests);
    } else if (this.props.flowMode === 'enroll') {
      let {registerRequests, authenticateRequests} = this.props.challengeData;
      promise = u2f.register(registerRequests, authenticateRequests);
    } else {
      throw new Error(`Unsupported flow mode '${this.props.flowMode}'`);
    }
    promise.then((data) => {
      this.setState({
        hasBeenTapped: true
      }, () => {
        this.state.responseElement.value = JSON.stringify(data);
        if (!this.props.onTap || this.props.onTap()) {
          this.state.formElement.submit();
        }
      });
    })
    .catch((err) => {
      let failure = 'DEVICE_ERROR';
      if (err.metaData.type === 'DEVICE_INELIGIBLE') {
        if (this.props.flowMode === 'enroll') {
          failure = 'DUPLICATE_DEVICE';
        } else {
          failure = 'UNKNOWN_DEVICE';
        }
      } else if (err.metaData.type === 'BAD_REQUEST') {
        failure = 'BAD_APPID';
      }
      this.setState({
        deviceFailure: failure,
        hasBeenTapped: false,
      });
    });
  },

  bindChallengeElement(ref) {
    this.setState({
      challengeElement: ref,
      formElement: ref.form
    });
    ref.value = JSON.stringify(this.props.challengeData);
  },

  bindResponseElement(ref) {
    this.setState({
      responseElement: ref
    });
  },

  renderUnsupported() {
    if (this.props.silentIfUnsupported) {
      return null;
    }
    return (
      <div className="u2f-box">
        <div className="inner">
          <p className="error">
            {t(`
             Unfortunately your browser does not support U2F. You need to use
             a different two-factor method or switch to a browser that supports
             it (Google Chrome or Microsoft Edge).
            `)}
          </p>
        </div>
      </div>
    );
  },

  canTryAgain() {
    return this.state.deviceFailure !== 'BAD_APPID';
  },

  renderFailure() {
    let {deviceFailure} = this.state;
    let supportMail = ConfigStore.get('supportEmail');
    let support = supportMail
      ? <a href={'mailto:' + supportMail}>{supportMail}</a>
      : <span>{t('Support')}</span>;
    return (
      <div className="failure-message">
        <p><strong>{t('Error: ')}</strong> {{
          'DEVICE_ERROR': t('Your U2F device reported an error.'),
          'DUPLICATE_DEVICE': t('This device is already in use.'),
          'UNKNOWN_DEVICE': t('The device you used for sign-in is unknown.'),
          'BAD_APPID': tct(
            '[p1:The Sentry server administrator modified the ' +
            'device registrations.]' + 
            '[p2:You need to remove and re-add the device to continue ' +
            'using your U2F device. Use a different sign-in method or ' +
            'contact [support] for assistance.]',
            {
              p1: <p/>,
              p2: <p/>,
              support: support,
            }
          ),
        }[deviceFailure]}</p>
        {this.canTryAgain() &&
          <p><a onClick={this.onTryAgain} className="btn btn-primary">{t('Try Again')}</a></p>}
      </div>
    );
  },

  renderBody() {
    if (this.state.deviceFailure) {
      return this.renderFailure();
    } else {
      return this.props.children;
    }
  },

  renderPrompt() {
    return (
      <div className={'u2f-box' + (this.state.hasBeenTapped ? ' tapped' : '')
          + (this.state.deviceFailure ? ' device-failure' : '')}>
        <div className="device-animation-frame">
          <div className="device-failed"/>
          <div className="device-animation"/>
          <div className="loading-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
        <input type="hidden" name="challenge" ref={this.bindChallengeElement}/>
        <input type="hidden" name="response" ref={this.bindResponseElement}/>
        <div className="inner">
          {this.renderBody()}
        </div>
      </div>
    );
  },

  render() {
    let {isSupported} = this.state;
    // if we are still waiting for the browser to tell us if we can do u2f
    // this will be null.
    if (isSupported === null) {
      return null;
    } else if (!isSupported) {
      return this.renderUnsupported();
    } else {
      return this.renderPrompt();
    }
  }
});

export default U2fInterface;
