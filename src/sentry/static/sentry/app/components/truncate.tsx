import * as React from 'react';
import PropTypes from 'prop-types';

type DefaultProps = {
  maxLength: number;
  leftTrim: boolean;
};

type Props = DefaultProps & {
  value: string;
  className?: string;
};

type State = {
  isExpanded: boolean;
};

class Truncate extends React.Component<Props, State> {
  static propTypes = {
    value: PropTypes.string.isRequired,
    leftTrim: PropTypes.bool,
    maxLength: PropTypes.number,
  };

  static defaultProps: DefaultProps = {
    maxLength: 50,
    leftTrim: false,
  };

  state = {
    isExpanded: false,
  };

  onFocus = () => {
    const {value, maxLength} = this.props;
    if (value.length <= maxLength) {
      return;
    }
    this.setState({isExpanded: true});
  };

  onBlur = () => {
    if (this.state.isExpanded) {
      this.setState({isExpanded: false});
    }
  };

  render() {
    const {leftTrim, maxLength, value} = this.props;
    const isTruncated = value.length > maxLength;
    let shortValue: React.ReactNode = '';

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
    if (this.state.isExpanded) {
      className += ' expanded';
    }

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
