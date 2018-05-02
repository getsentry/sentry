import PropTypes from 'prop-types';
import React from 'react';

class Truncate extends React.Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    leftTrim: PropTypes.bool,
    maxLength: PropTypes.number,
  };

  static defaultProps = {
    leftTrim: false,
    maxLength: 50,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isExpanded: false,
    };
  }

  onFocus = e => {
    let {value, maxLength} = this.props;
    if (value.length <= maxLength) return;
    this.setState({isExpanded: true});
  };

  onBlur = e => {
    if (this.state.isExpanded) this.setState({isExpanded: false});
  };

  render() {
    let {leftTrim, maxLength, value} = this.props;
    let isTruncated = value.length > maxLength;
    let shortValue = '';

    if (isTruncated) {
      if (leftTrim) {
        shortValue = (
          <span>… {value.slice(value.length - (maxLength - 4), value.length)}</span>
        );
      } else {
        shortValue = <span>{value.slice(0, maxLength - 4)} …</span>;
      }
    } else {
      shortValue = value;
    }

    let className = this.props.className || '';
    className += ' truncated';
    if (this.state.isExpanded) className += ' expanded';

    return (
      <span
        className={className}
        onMouseOver={this.onFocus}
        onMouseOut={this.onBlur}
        onFocus={this.onFocus}
        onBlur={this.onBlur}
      >
        <span className="short-value">{shortValue}</span>
        {isTruncated && <span className="full-value">{value}</span>}
      </span>
    );
  }
}

export default Truncate;
