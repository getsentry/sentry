import React from 'react';
import u2f from 'u2f-api';

import {t} from '../locale';

const U2fEnrollment = React.createClass({
  propTypes: {
    enrollmentData: React.PropTypes.object
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
      let {registerRequests, authenticateRequests} = this.props.enrollmentData;
      u2f.register(registerRequests, authenticateRequests).then((data) => {
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
    ref.value = JSON.stringify(this.props.enrollmentData);
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
          Unfortunately your browser does not support U2F.  You need to add
          a different authentication method or switch to a browser that
          supports it (for instance Microsoft Edge or Google Chrome).
        `)}
      </p>
    );
  },

  renderEnrollment() {
    return (
      <div className="enrollment">
        <input type="hidden" name="challenge" ref={this.bindChallengeElement}/>
        <input type="hidden" name="response" ref={this.bindResponseElement}/>
        <p>
          {t(`
            To enroll your U2F device insert it now or tap the button on it
            to activate it.
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
      return this.renderEnrollment();
    }
  }
});

export default U2fEnrollment;
