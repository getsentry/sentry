import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type DefaultProps = {
  maxLength: number;
  leftTrim: boolean;
  expandable: boolean;
  expandDirection: 'left' | 'right';
};

type Props = DefaultProps & {
  value: string;
  className?: string;
  trimRegex?: RegExp;
};

type State = {
  isExpanded: boolean;
};

class Truncate extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    maxLength: 50,
    leftTrim: false,
    expandable: true,
    expandDirection: 'right',
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
    const {
      leftTrim,
      trimRegex,
      maxLength,
      value,
      expandable,
      expandDirection,
    } = this.props;
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

    const className = this.props.className || '';

    return (
      <TruncatedContainer
        className={className}
        onMouseOver={expandable ? this.onFocus : undefined}
        onMouseOut={expandable ? this.onBlur : undefined}
        onFocus={expandable ? this.onFocus : undefined}
        onBlur={expandable ? this.onBlur : undefined}
      >
        <span>{shortValue}</span>
        {isTruncated && (
          <FullValue expanded={this.state.isExpanded} expandDirection={expandDirection}>
            {value}
          </FullValue>
        )}
      </TruncatedContainer>
    );
  }
}

const TruncatedContainer = styled('span')`
  position: relative;
`;

export const FullValue = styled('span')<{
  expanded: boolean;
  expandDirection: 'left' | 'right';
}>`
  display: none;
  position: absolute;
  background: ${p => p.theme.background};
  padding: ${space(0.5)};
  border: 1px solid ${p => p.theme.innerBorder};
  white-space: nowrap;
  border-radius: ${space(0.5)};
  top: -5px;
  ${p => p.expandDirection === 'left' && 'right: -5px;'}
  ${p => p.expandDirection === 'right' && 'left: -5px;'}

  ${p =>
    p.expanded &&
    `
    z-index: ${p.theme.zIndex.truncationFullValue};
    display: block;
    `}
`;

export default Truncate;
