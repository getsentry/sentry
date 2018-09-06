import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

class HeaderItem extends React.Component {
  static propTypes = {
    label: PropTypes.node,

    /**
     * className for <Label> component
     */
    labelClassName: PropTypes.string,
  };

  render() {
    const {className, labelClassName, label, children} = this.props;

    return (
      <StyledHeaderItem className={className}>
        <Label className={labelClassName}>
          {label}
        </Label>
        {children}
      </StyledHeaderItem>
    );
  }
}

export default HeaderItem;

const StyledHeaderItem = styled(props => (
  <Flex direction="column" justify="center" {...props} />
))`
  text-align: left;

  .dropdown-actor-title {
    font-size: 15px;
    height: auto;
    color: ${p => p.theme.button.default.colorActive};
  }
`;

const Label = styled('label')`
  font-weight: 400;
  font-size: 13px;
  color: ${p => p.theme.gray6};
  height: 14px;

`;
