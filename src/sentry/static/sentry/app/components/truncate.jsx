import React from 'react';

const Truncate = React.createClass({
  propTypes: {
    value: React.PropTypes.string.isRequired,
    leftTrim: React.PropTypes.bool,
    maxLength: React.PropTypes.number,
  },

  getDefaultProps() {
    return {
      leftTrim: false,
      maxLength: 50,
    };
  },

  getInitialState() {
    return {
      isExpanded: false,
    };
  },

  onFocus(e) {
    let {value, maxLength} = this.props;
    if (value.length <= maxLength) return;
    this.setState({isExpanded: true});
  },

  onBlur(e) {
    if (this.state.isExpanded)
      this.setState({isExpanded: false});
  },

  render() {
    let {leftTrim, maxLength, value} = this.props;
    let isTruncated = (value.length > maxLength);
    let shortValue = '';

    if (isTruncated) {
      if (leftTrim) {
        shortValue = <span>&hellip; {value.slice(value.length - (maxLength - 4), value.length)}</span>;
      } else {
        shortValue = <span>{value.slice(0, maxLength - 4)} &hellip;</span>;
      }
    } else {
      shortValue = value;
    }

    let className = this.props.className || '';
    className += ' truncated';
    if (this.state.isExpanded)
      className += ' expanded';

    return (
      <span
        className={className}
        onMouseOver={this.onFocus}
        onMouseOut={this.onBlur}
        onFocus={this.onFocus}
        onBlur={this.onBlur}>
        <span className="short-value">{shortValue}</span>
        {isTruncated &&
          <span className="full-value">{value}</span>
        }
      </span>
    );
  }
});

export default Truncate;

