import React from 'react';
import u2f from 'u2f-api';

import {t} from '../locale';

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
      this.state.responseElement.value = JSON.stringify(data);
      if (!this.props.onTap || this.props.onTap()) {
        this.state.formElement.submit();
      }
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
        <p className="error">
          {t(`
           Unfortunately your browser does not support U2F. You need to use
           a different two-factor method or switch to a browser that supports
           it (Google Chrome or Microsoft Edge).
          `)}
        </p>
      </div>
    );
  },

  renderPrompt() {
    return (
      <div className="u2f-box">
        <input type="hidden" name="challenge" ref={this.bindChallengeElement}/>
        <input type="hidden" name="response" ref={this.bindResponseElement}/>
        {this.props.children}
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
