import React from 'react';

import U2fInterface from './u2finterface';
import {t} from '../locale';

const U2fEnrollment = React.createClass({
  propTypes: {
    enrollmentData: React.PropTypes.object
  },

  render() {
    return (
      <U2fInterface
        challengeData={this.props.enrollmentData}
        flowMode={'enroll'}>
        <p>
          {t(`
            To enroll your U2F device insert it now or tap the button on it
            to activate it.
          `)}
        </p>
      </U2fInterface>
    );
  }
});

export default U2fEnrollment;
