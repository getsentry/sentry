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
    onClear: PropTypes.func,
    /**
     * className for <Label> component
     */
    labelClassName: PropTypes.string,
  };

  onClear = (e) => {
    e.stopPropagation();
    this.props.onClear();
  }

  render() {
    const {className, label, children, isOpen, hasSelected, icon} = this.props;

    return (
      <StyledHeaderItem className={className} {...this.props}>
        <IconContainer hasSelected={hasSelected}>{icon}</IconContainer>
        <Content>{children}</Content>
        {hasSelected && <StyledClose src="icon-close" onClick={this.onClear}/>}
        <StyledChevron src="icon-chevron-down" isOpen={isOpen}/>
      </StyledHeaderItem>
    );
  }
}

const StyledHeaderItem = styled('div')`
  display: flex;
  padding: 0 ${space(3)};
  align-items: center;
  cursor: pointer;
  color: ${p => p.isOpen ? p.theme.gray4 : p.theme.gray2};
  transition: 0.1s color;
  user-select: none;
`;

const Content = styled('div')`
  flex: 1;
  ${overflowEllipsis};
`;

const IconContainer = styled('span')`
  color: ${p => p.hasSelected ? p.theme.blue : p.theme.gray2};
  margin-right: ${space(1.5)};
`;

const StyledClose = styled(InlineSvg)`
  color: ${p => p.theme.gray2};
  height: 10px;
  width: 10px;
  margin-right: ${p => space(1)};
  stroke-width: 1.5;
`;

const StyledChevron = styled(InlineSvg)`
  transform: rotate(${p => p.isOpen ? "180deg" : "0deg"});
  transition: 0.1s transform;
`;

export default HeaderItem;
