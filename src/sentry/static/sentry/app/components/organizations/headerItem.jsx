import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';
import InlineSvg from '../inlineSvg';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

class HeaderItem extends React.Component {
  static propTypes = {
    label: PropTypes.node,

    /**
     * className for <Label> component
     */
    labelClassName: PropTypes.string,
  };

  render() {
    const {className, label, children, active} = this.props;

    return (
      <StyledHeaderItem className={className} {...this.props}>
        <Content>{children}</Content>
        <InlineSvg src="icon-chevron-down" />
      </StyledHeaderItem>
    );
  }
}


const StyledHeaderItem = styled('div')`
  flex-direction: column;
  display: grid;
  grid-template-columns: minmax(1em, 1fr) 1em;
  grid-column-gap: ${space(0.25)};
  padding: 0 ${space(3)};
  align-items: center;
  color: ${p => p.theme.button.default.colorActive};
  cursor: pointer;
`;

const Content = styled('div')`
  ${overflowEllipsis};
`;

export default HeaderItem;
