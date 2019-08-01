import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

class Pill extends React.Component {
  static propTypes = {
    name: PropTypes.string,
    value: PropTypes.any,
  };

  renderValue = () => {
    const {value} = this.props;
    if (value === undefined) {
      return [null, null];
    }
    let extraClass = null;
    let renderedValue;
    if (value === true || value === false) {
      extraClass = value ? 'true' : 'false';
      renderedValue = value ? 'yes' : 'no';
    } else if (value === null) {
      extraClass = 'false';
      renderedValue = 'n/a';
    } else {
      renderedValue = value.toString();
    }
    return [extraClass, renderedValue];
  };

  render() {
    const {name, children, ...props} = this.props;
    const [renderedValue] = this.renderValue();

    return (
      <StyledPill {...props}>
        <StyledPillKey>{name}</StyledPillKey>
        <StyledPillValue>
          {renderedValue}
          {children}
        </StyledPillValue>
      </StyledPill>
    );
  }
}

const StyledPill = styled('li')`
  white-space: nowrap;
  margin: 0 10px 10px 0;
  display: flex;
  border: 1px solid #d0c9d7;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  line-height: 1.2;
  max-width: 100%;
  &.true .value {
    background: #fbfefa;
    border: 1px solid #c7dbbd;
    margin: -1px;
    color: #6a726c;
  }
  &.false .value {
    background: #fff9f9;
    border: 1px solid #e5c4c4;
    margin: -1px;
    color: #766a6a;
  }
  &:last-child {
    margin-right: 0;
  }
`;

const SharedPillValue = css`
  padding: 4px 8px;
  min-width: 0;
  white-space: nowrap;
`;

const StyledPillValue = styled('span')`
  ${SharedPillValue}
  background: #fbfbfc;
  border-left: 1px solid #d8d2de;
  border-radius: 0 3px 3px 0;
  font-family: Monaco, monospace;
  max-width: 100%;
  text-overflow: ellipsis;
  > a {
    max-width: 100%;
    display: inline-block;
    vertical-align: text-bottom;
  }
  .pill-icon,
  .external-icon {
    display: inline;
    margin: 0 0 0 8px;
    color: #968ba0;
    line-height: 1.2;
    &:hover {
      color: #625471;
    }
  }
`;

const StyledPillKey = styled('span')`
  ${SharedPillValue}
`;

export default Pill;
