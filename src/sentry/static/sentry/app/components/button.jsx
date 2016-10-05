import jQuery from 'jquery';
import React from 'react';
import classNames from 'classnames';

import LoadingIndicator from '../components/LoadingIndicator';

const Button = React.createClass({
  propTypes: {
    progress: React.PropTypes.bool,
    disabled: React.PropTypes.bool,
    icon: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      progressBar: false,
      disabled: false,
    };
  },
  getInitialState() {
    return {
      isInitiated: false,
      isComplete: false,
    };
  },

  click() {
    this.setState({isInitiated: true});
    setTimeout(this.setState.bind(this, {isComplete: true}), 500);
  },

  render() {
    let className = classNames({
      'btn': true,
      'btn-progress': this.props.progress,
      'disabled': this.props.disabled,
      'initiated' : this.state.isInitiated,
      'complete' : this.state.isComplete
    });

    return (
      <a
        className={classNames(this.props.className, className)}
        ref="button" onClick={this.click}>

        <span className="btn-text">{this.props.children}</span>

        {this.props.progress &&
          <span>
            <LoadingIndicator mini={true} />
            <span className="btn-complete"><span className="icon-checkmark"/></span>
          </span>
        }
      </a>
    );
  }
});

export default Button;
