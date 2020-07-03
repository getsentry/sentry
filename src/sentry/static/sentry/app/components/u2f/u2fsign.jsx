import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';

import U2fInterface from './u2finterface';

const MESSAGES = {
  signin: t(
    'Insert your U2F device or tap the button on it to confirm the sign-in request.'
  ),
  sudo: t('Alternatively you can use your U2F device to confirm the action.'),
  enroll: t(
    'To enroll your U2F device insert it now or tap the button on it to activate it.'
  ),
};

class U2fSign extends React.Component {
  static propTypes = {
    challengeData: PropTypes.object,
    displayMode: PropTypes.string,
  };

  static defaultProps = {
    displayMode: 'signin',
  };

  render() {
    const {displayMode, ...props} = this.props;
    const flowMode = displayMode === 'enroll' ? 'enroll' : 'sign';
    return (
      <U2fInterface
        {...props}
        silentIfUnsupported={displayMode === 'sudo'}
        flowMode={flowMode}
      >
        <p>{MESSAGES[displayMode] || null}</p>
      </U2fInterface>
    );
  }
}

export default U2fSign;
