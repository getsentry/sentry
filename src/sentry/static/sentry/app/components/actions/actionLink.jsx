import React from 'react';
import PropTypes from 'prop-types';
import Confirm from '../confirm';
import {t} from '../../locale';

export default class ActionLink extends React.Component {
  static propTypes = {
    shouldConfirm: PropTypes.bool,
    message: PropTypes.node,
    className: PropTypes.any,
    onAction: PropTypes.func.isRequired,
    title: PropTypes.string,
    confirmLabel: PropTypes.string.isRequired,
  };

  static defaultProps = {
    shouldConfirm: false,
  };

  render() {
    let {
      shouldConfirm,
      message,
      className,
      title,
      onAction,
      confirmLabel,
      children,
    } = this.props;

    let confirmMessage = (
      <div>
        {message}
        <p>{t('This action cannot be undone.')}</p>
      </div>
    );

    if (shouldConfirm) {
      return (
        <Confirm message={confirmMessage} confirmText={confirmLabel} onConfirm={onAction}>
          <a className={className} title={title}>
            {' '}
            {children}
          </a>
        </Confirm>
      );
    } else {
      return (
        <a className={className} onClick={onAction}>
          {children}
        </a>
      );
    }
  }
}
