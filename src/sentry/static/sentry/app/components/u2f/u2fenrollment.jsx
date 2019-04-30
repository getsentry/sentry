import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import U2fInterface from './u2finterface';

class U2fEnrollment extends React.Component {
  static propTypes = {
    enrollmentData: PropTypes.object,
  };

  render() {
    return (
      <U2fInterface challengeData={this.props.enrollmentData} flowMode="enroll">
        <p>
          {t(
            `
            To enroll your U2F device insert it now or tap the button on it
            to activate it.
          `
          )}
        </p>
      </U2fInterface>
    );
  }
}

export default U2fEnrollment;
