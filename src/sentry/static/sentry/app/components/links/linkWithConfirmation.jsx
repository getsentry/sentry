import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import Confirm from 'app/components/confirm';

/**
 * <Confirm> is a more generic version of this component
 */
class LinkWithConfirmation extends React.PureComponent {
  static propTypes = {
    disabled: PropTypes.bool,
    message: PropTypes.node.isRequired,
    title: PropTypes.node.isRequired,
    onConfirm: PropTypes.func.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isModalOpen: false,
    };
  }

  render() {
    const {className, disabled, title, children, ...otherProps} = this.props;
    return (
      <Confirm {...otherProps} disabled={disabled}>
        <a
          className={classNames(className || '', {disabled})}
          disabled={disabled}
          onClick={this.onToggle}
          title={title}
        >
          {children}
        </a>
      </Confirm>
    );
  }
}

export default LinkWithConfirmation;
