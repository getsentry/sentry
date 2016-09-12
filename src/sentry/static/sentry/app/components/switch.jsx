import React from 'react';

const Switch = React.createClass({
  propTypes: {
    size: React.PropTypes.string,
    isActive: React.PropTypes.bool,
    isLoading: React.PropTypes.bool,
    toggle: React.PropTypes.func.isRequired,
  },

  render() {

    let switchClasses = 'switch';

    if (this.props.size) {
      switchClasses += ' switch-' + this.props.size;
    }

    if (this.props.isActive) {
      switchClasses += ' switch-on';
    }

    if (this.props.isLoading) {
      switchClasses += ' switch-disabled';
    }

    return (
      <div className={switchClasses} onClick={this.props.toggle} role="checkbox" aria-checked={this.props.isActive}>
        <span className="switch-toggle"/>
      </div>
    );
  }
});

export default Switch;
