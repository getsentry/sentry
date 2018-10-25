import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

class HeaderItem extends React.Component {
  static propTypes = {
    label: PropTypes.node,
    icon: PropTypes.element,
    /**
     * className for <Label> component
     */
    labelClassName: PropTypes.string,
  };

  render() {
    const {className, label, children, active, icon} = this.props;

    return (
      <StyledHeaderItem className={className} {...this.props}>
        <IconContainer active={active}>{icon}</IconContainer>
        <Content>{children}</Content>
        <StyledChevron src="icon-chevron-down" active={active}/>
      </StyledHeaderItem>
    );
  }
}

const StyledHeaderItem = styled('div')`
  flex-direction: column;
  display: grid;
  grid-template-columns: auto minmax(1em, 1fr) 1em;
  grid-column-gap: ${space(0.25)};
  padding: 0 ${space(3)};
  align-items: center;
  color: ${p => p.theme.button.default.colorActive};
  cursor: pointer;
  color: ${p => p.active ? p.theme.gray4 : p.theme.gray2};
  transition: 0.1s color;
`;

const Content = styled('div')`
  ${overflowEllipsis};
`;

const IconContainer = styled('span')`
  color: ${p => p.active ? p.theme.blue : p.theme.gray2};
  margin-right: ${space(1.5)};
`;

const StyledChevron = styled(InlineSvg)`
  transform: rotate(${p => p.active ? "180deg" : "0deg"});
  transition: 0.1s transform;
`;

export default HeaderItem;
