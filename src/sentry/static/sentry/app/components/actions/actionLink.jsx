import React from 'react';
import PropTypes from 'prop-types';

import Confirm from '../confirm';

export default class ActionLink extends React.Component {
  static propTypes = {
    shouldConfirm: PropTypes.bool,
    message: PropTypes.node,
    className: PropTypes.any,
    onAction: PropTypes.func.isRequired,
    title: PropTypes.string,
    confirmLabel: PropTypes.string,
    disabled: PropTypes.bool,
  };

  static defaultProps = {
    shouldConfirm: false,
    disabled: false,
  };

  render() {
    let {
      shouldConfirm,
      message,
      className,
      title,
      onAction,
      confirmLabel,
      disabled,
      children,
    } = this.props;

    if (shouldConfirm) {
      return (
        <Confirm message={message} confirmText={confirmLabel} onConfirm={onAction}>
          <a className={className} title={title} disabled={disabled}>
            {' '}
            {children}
          </a>
        </Confirm>
      );
    } else {
      return (
        <a className={className} onClick={!disabled && onAction} disabled={disabled}>
          {children}
        </a>
      );
    }
  }
}
