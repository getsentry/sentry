import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import Confirm from 'app/components/confirm';

type DefaultProps = {
  disabled: boolean;
  shouldConfirm: boolean;
};

type ActionLinkProps = DefaultProps & {
  title: string;
  message: React.ReactNode;
  onAction: () => void;
  confirmLabel?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export default class ActionLink extends React.Component<ActionLinkProps> {
  static propTypes = {
    className: PropTypes.any,
    title: PropTypes.string,
    message: PropTypes.node,
    disabled: PropTypes.bool,
    onAction: PropTypes.func.isRequired,
    shouldConfirm: PropTypes.bool,
    confirmLabel: PropTypes.string,
  };

  static defaultProps: DefaultProps = {
    shouldConfirm: false,
    disabled: false,
  };

  render() {
    const {
      shouldConfirm,
      message,
      className,
      title,
      onAction,
      confirmLabel,
      disabled,
      children,
    } = this.props;
    const testId = title
      ? 'action-link-' + title.toLowerCase().replace(/ /g, '-')
      : 'action-link';

    if (shouldConfirm && !disabled) {
      return (
        <Confirm message={message} confirmText={confirmLabel} onConfirm={onAction}>
          <a className={className} title={title} aria-label={title}>
            {' '}
            {children}
          </a>
        </Confirm>
      );
    } else {
      return (
        <ActionLinkAnchor
          data-test-id={testId}
          aria-label={title}
          className={classNames(className, {disabled})}
          onClick={disabled ? undefined : onAction}
          disabled={disabled}
        >
          {children}
        </ActionLinkAnchor>
      );
    }
  }
}
const ActionLinkAnchor = styled('a')<{disabled?: boolean}>`
  display: flex;
  align-items: center;
  pointer-events: ${p => (p.disabled ? 'none' : 'auto')};
`;
