import React from 'react';

type DefaultProps = {
  maxLength: number;
  leftTrim: boolean;
  expandable: boolean;
};

type Props = DefaultProps & {
  value: string;
  className?: string;
};

type State = {
  isExpanded: boolean;
};

class Truncate extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    maxLength: 50,
    leftTrim: false,
    expandable: true,
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
    const {leftTrim, maxLength, value, expandable} = this.props;
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
        onMouseOver={expandable ? this.onFocus : undefined}
        onMouseOut={expandable ? this.onBlur : undefined}
        onFocus={expandable ? this.onFocus : undefined}
        onBlur={expandable ? this.onBlur : undefined}
      >
        <span className="short-value">{shortValue}</span>
        {isTruncated && <span className="full-value">{value}</span>}
      </span>
    );
  }
}

export default Truncate;
