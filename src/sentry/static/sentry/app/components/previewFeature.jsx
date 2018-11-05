import React, {Component} from 'react';
import {t} from 'app/locale';
import PropTypes from 'prop-types';
import Alert from './alert';

export default class PreviewFeature extends Component {
  static propTypes = {
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  };

  static defaultProps = {
    type: 'warning',
  };

  render() {
    const {type} = this.props;

    return (
      <Alert type={type} icon="icon-labs">
        {t(
          'This feature is a preview and may change in the future. Thanks for being an early adopter!'
        )}
      </Alert>
    );
  }
}
