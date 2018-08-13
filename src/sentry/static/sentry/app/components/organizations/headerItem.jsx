import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

class HeaderItem extends React.Component {
  static propTypes = {
    label: PropTypes.node,
    align: PropTypes.oneOf(['right', 'left']),
  };

  static defaultProps = {
    align: 'right',
  };

  render() {
    const {className, label, align, children} = this.props;

    return (
      <StyledHeaderItem align={align} className={className}>
        <Label>{label}</Label>
        {children}
      </StyledHeaderItem>
    );
  }
}

export default HeaderItem;

const StyledHeaderItem = styled(props => (
  <Flex direction="column" justify="center" {...props} />
))`
  text-align: ${p => p.align};
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
  margin-bottom: 12px;
`;
