import React from 'react';

type DefaultProps = {
  maxLength: number;
  leftTrim: boolean;
  trimRegex?: RegExp;
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
    const {leftTrim, trimRegex, maxLength, value, expandable} = this.props;
    const isTruncated = value.length > maxLength;
    let shortValue: React.ReactNode = '';

    if (isTruncated) {
      const slicedValue = leftTrim
        ? value.slice(value.length - (maxLength - 4), value.length)
        : value.slice(0, maxLength - 4);

      // Try to trim to values from the regex
      if (trimRegex && slicedValue.search(trimRegex) >= 0) {
        if (leftTrim) {
          shortValue = (
            <span>
              … {slicedValue.slice(slicedValue.search(trimRegex), slicedValue.length)}
            </span>
          );
        } else {
          const matches = slicedValue.match(trimRegex);
          const lastIndex = matches
            ? slicedValue.lastIndexOf(matches[matches.length - 1]) + 1
            : slicedValue.length;
          shortValue = <span>{slicedValue.slice(0, lastIndex)} …</span>;
        }
      } else if (leftTrim) {
        shortValue = <span>… {slicedValue}</span>;
      } else {
        shortValue = <span>{slicedValue} …</span>;
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
