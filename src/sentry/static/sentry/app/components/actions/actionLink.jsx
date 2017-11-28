import React from 'react';
import PropTypes from 'prop-types';
import Confirm from '../confirm';
import {t} from '../../locale';

export default class ActionLink extends React.Component {
  static propTypes = {
    shouldConfirm: PropTypes.bool,
    confirmationQuestion: PropTypes.node,
    extraDescription: PropTypes.node,
    className: PropTypes.any,
    onAction: PropTypes.func.isRequired,
    title: PropTypes.string,
  };

  static defaultProps = {
    shouldConfirm: false,
  };

  render() {
    let {
      shouldConfirm,
      confirmationQuestion,
      extraDescription,
      className,
      title,
      onAction,
      children,
    } = this.props;

    let message = (
      <div>
        <p>
          <strong>{confirmationQuestion}</strong>
        </p>
        {extraDescription}
        <p>{t('This action cannot be undone.')}</p>
      </div>
    );

    if (shouldConfirm) {
      return (
        <a className={className} title={title}>
          <Confirm message={message} confirmText={t('Resolve')} onConfirm={onAction}>
            <span>{children}</span>
          </Confirm>
        </a>
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
