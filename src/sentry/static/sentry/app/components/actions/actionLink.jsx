import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';

export default class ActionLink extends React.Component {
  static propTypes = {
    shouldConfirm: PropTypes.bool,
    isButton: PropTypes.bool,
    message: PropTypes.node,
    className: PropTypes.any,
    onAction: PropTypes.func.isRequired,
    title: PropTypes.string,
    confirmLabel: PropTypes.string,
    disabled: PropTypes.bool,
    buttonProps: PropTypes.object,
  };

  static defaultProps = {
    shouldConfirm: false,
    disabled: false,
    buttonProps: {},
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
      isButton,
      buttonProps,
    } = this.props;

    const Component = isButton ? Button : 'a';
    const componentProps = {...(isButton ? buttonProps : {})};

    if (shouldConfirm && !disabled) {
      return (
        <Confirm message={message} confirmText={confirmLabel} onConfirm={onAction}>
          <Component className={className} title={title} {...componentProps}>
            {' '}
            {children}
          </Component>
        </Confirm>
      );
    } else {
      return (
        <Component
          className={classNames(className, {disabled})}
          onClick={disabled ? undefined : onAction}
          disabled={disabled}
          {...componentProps}
        >
          {children}
        </Component>
      );
    }
  }
}
