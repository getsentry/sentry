import React from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import Confirm from 'app/components/confirm';

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

    if (shouldConfirm && !disabled) {
      return (
        <Confirm message={message} confirmText={confirmLabel} onConfirm={onAction}>
          <a className={className} title={title}>
            {' '}
            {children}
          </a>
        </Confirm>
      );
    } else {
      return (
        <a
          className={classNames(className, {disabled})}
          onClick={disabled ? undefined : onAction}
          disabled={disabled}
        >
          {children}
        </a>
      );
    }
  }
}
