import React from 'react';
import PropTypes from 'prop-types';

import Confirm from './confirm';

/**
 * <Confirm> is a more generic version of this component
 */
class LinkWithConfirmation extends React.PureComponent {
  static propTypes = {
    disabled: PropTypes.bool,
    message: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    onConfirm: PropTypes.func.isRequired
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isModalOpen: false
    };
  }

  render() {
    let {className, disabled, title, children, ...otherProps} = this.props;
    if (this.props.disabled) {
      className += ' disabled';
    }
    return (
      <Confirm {...otherProps} disabled={disabled}>
        <a
          className={className}
          disabled={disabled}
          onClick={this.onToggle}
          title={title}>
          {children}
        </a>
      </Confirm>
    );
  }
}

export default LinkWithConfirmation;
