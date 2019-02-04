import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

class HeaderItem extends React.Component {
  static propTypes = {
    allowClear: PropTypes.bool,
    icon: PropTypes.element,
    onClear: PropTypes.func,
    onSubmit: PropTypes.func,
    hasChanges: PropTypes.bool,
    hasSelected: PropTypes.bool,
    isOpen: PropTypes.bool,
  };

  static defaultProps = {
    allowClear: true,
  };

  handleClear = e => {
    e.stopPropagation();
    this.props.onClear();
  };

  handleChevronClick = e => {
    if (!this.props.hasChanges) {
      return;
    }

    e.stopPropagation();
    this.props.onSubmit();
  };

  render() {
    const {
      className,
      children,
      isOpen,
      hasSelected,
      hasChanges,
      allowClear,
      icon,
      onClear, // eslint-disable-line no-unused-vars
      onSubmit, // eslint-disable-line no-unused-vars
      ...props
    } = this.props;

    return (
      <StyledHeaderItem
        className={className}
        isOpen={isOpen}
        hasSelected={hasSelected}
        {...props}
      >
        <IconContainer hasSelected={hasSelected}>{icon}</IconContainer>
        <Content>{children}</Content>
        {hasSelected &&
          allowClear && <StyledClose src="icon-close" onClick={this.handleClear} />}
        <StyledChevron
          isOpen={isOpen}
          hasChanges={hasChanges}
          onClick={this.handleChevronClick}
        >
          <InlineSvg src="icon-chevron-down" />
        </StyledChevron>
      </StyledHeaderItem>
    );
  }
}

const StyledHeaderItem = styled('div')`
  display: flex;
  padding: 0 ${space(4)};
  align-items: center;
  cursor: pointer;
  color: ${p => (p.isOpen || p.hasSelected ? p.theme.gray4 : p.theme.gray2)};
  transition: 0.1s color;
  user-select: none;
`;

const Content = styled('div')`
  flex: 1;
  margin-right: ${space(1.5)};
  ${overflowEllipsis};
`;

const IconContainer = styled('span')`
  color: ${p => (p.hasSelected ? p.theme.blue : null)};
  margin-right: ${space(1.5)};
`;

const StyledClose = styled(InlineSvg)`
  color: ${p => p.theme.gray2};
  height: 10px;
  width: 10px;
  stroke-width: 1.5;
  padding: ${space(1)};
  box-sizing: content-box;
  margin: -${space(1)} 0px -${space(1)} -${space(1)};
`;

const StyledChevron = styled('div')`
  transform: rotate(${p => (p.isOpen ? '180deg' : '0deg')});
  transition: 0.1s all;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  ${p =>
    p.hasChanges
      ? `
    background: ${p.theme.purple};
    border-radius: 2em;
    width: 20px;
    height: 20px;
    color: #fff;
    transform: rotate(270deg);
  `
      : ''};
`;

export default React.forwardRef((props, ref) => <HeaderItem {...props} innerRef={ref} />);
