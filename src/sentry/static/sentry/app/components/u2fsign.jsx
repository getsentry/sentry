import React from 'react';

import U2fInterface from './u2finterface';
import {t} from '../locale';

const U2fSign = React.createClass({
  propTypes: {
    challengeData: React.PropTypes.object
  },

  render() {
    return (
      <U2fInterface
        challengeData={this.props.challengeData}
        flowMode={'sign'}>
        <p>
          {t(`
            Insert your U2F device or tap the button on it to confirm the
            sign-in request.
          `)}
        </p>
      </U2fInterface>
    );
  }
});

export default U2fSign;
