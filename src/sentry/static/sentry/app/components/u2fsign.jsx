import React from 'react';

import U2fInterface from './u2finterface';
import {t} from '../locale';

const U2fSign = React.createClass({
  propTypes: {
    challengeData: React.PropTypes.object,
    displayMode: React.PropTypes.string,
  },

  getDefaultProps() {
    return {
      displayMode: 'signin'
    };
  },

  render() {
    const {displayMode} = this.props;
    return (
      <U2fInterface
        challengeData={this.props.challengeData}
        silentIfUnsupported={displayMode === 'sudo'}
        flowMode={'sign'}>
        <p>
          {displayMode === 'signin' ? t(`
            Insert your U2F device or tap the button on it to confirm the
            sign-in request.
          `) : displayMode === 'sudo' ? t(`
            Alternatively you can use your U2F device to confirm the action.
          `) : null}
        </p>
      </U2fInterface>
    );
  }
});

export default U2fSign;
