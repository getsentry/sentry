import React from 'react';
import u2f from 'u2f-api';

import {t} from '../locale';

const U2fSign = React.createClass({
  propTypes: {
    challengeData: React.PropTypes.object
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
      u2f.sign(this.props.challengeData.authenticateRequests).then((data) => {
        this.state.responseElement.value = JSON.stringify(data);
        this.state.formElement.submit();
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
    return (
      <p className="error">
        {t(`
          Unfortunately your browser does not support U2F so you need to use
          a different sign in method.
        `)}
      </p>
    );
  },

  renderPrompt() {
    return (
      <div>
        <input type="hidden" name="challenge" ref={this.bindChallengeElement}/>
        <input type="hidden" name="response" ref={this.bindResponseElement}/>
        <p>
          {t(`
            Insert your U2F device or tap the button on it to confirm the
            sign-in request.
          `)}
        </p>
      </div>
    );
  },

  render() {
    let {isSupported} = this.state;
    if (isSupported === null) {
      return null;
    } else if (!isSupported) {
      return this.renderUnsupported();
    } else {
      return this.renderPrompt();
    }
  }
});

export default U2fSign;
