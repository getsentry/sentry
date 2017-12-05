import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

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
    isDisabled: false,
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

    let cx = classNames(className, {
      disabled,
    });

    if (shouldConfirm) {
      return (
        <Confirm message={message} confirmText={confirmLabel} onConfirm={onAction}>
          <a className={cx} title={title}>
            {' '}
            {children}
          </a>
        </Confirm>
      );
    } else {
      return (
        <a className={cx} onClick={!disabled && onAction}>
          {children}
        </a>
      );
    }
  }
}
