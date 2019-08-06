import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import space from 'app/styles/space';

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
    const [extraClass, renderedValue] = this.renderValue();
    return (
      <StyledPill {...props}>
        <PillName>{name}</PillName>
        <PillValue type={extraClass}>
          {renderedValue}
          {children}
        </PillValue>
      </StyledPill>
    );
  }
}

const StyledPill = styled('li')`
  white-space: nowrap;
  margin: 0 10px 10px 0;
  display: flex;
  border: 1px solid ${p => p.theme.gray1};
  border-radius: 3px;
  box-shadow: ${p => p.theme.dropShadowLightest};
  line-height: 1.2;
  max-width: 100%;
  &:last-child {
    margin-right: 0;
  }
`;

const PillName = styled('span')`
  padding: ${space(0.5)} ${space(1)};
  min-width: 0;
  white-space: nowrap;
`;

const PillValue = styled(PillName)`
  background: ${p => p.theme.whiteDark};
  border-left: 1px solid ${p => p.theme.gray1};
  border-radius: 0 3px 3px 0;
  font-family: ${p => p.theme.text.familyMono};
  max-width: 100%;
  > a {
    max-width: 100%;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    display: inline-block;
    vertical-align: text-bottom;
  }
  .external-icon {
    display: inline;
    margin: 0 0 0 ${space(1)};
    color: ${p => p.theme.gray2};
    line-height: 1.2;
    &:hover {
      color: ${p => p.theme.gray4};
    }
  }
  /* .true - good values */
  ${p =>
    p.type === 'true' &&
    `
    background: ${p.theme.greenLightest};
    border-top: 1px solid ${p.theme.green};
    border-right: 1px solid ${p.theme.green};
    border-bottom: 1px solid ${p.theme.green};
    margin: -1px;
  `}

  /* .false - error values */
  ${p =>
    p.type === 'false' &&
    `
    background: ${p.theme.redLightest};
    border-top: 1px solid ${p.theme.red};
    border-right: 1px solid ${p.theme.red};
    border-bottom: 1px solid ${p.theme.red};
    margin: -1px;
  `}
`;

export default Pill;
