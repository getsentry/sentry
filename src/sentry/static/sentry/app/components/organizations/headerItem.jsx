import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';
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
    locked: PropTypes.bool,
    lockedMessage: PropTypes.string,
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
      locked,
      lockedMessage,
      onClear, // eslint-disable-line no-unused-vars
      onSubmit, // eslint-disable-line no-unused-vars
      ...props
    } = this.props;

    return (
      <StyledHeaderItem
        className={className}
        isOpen={isOpen}
        hasSelected={hasSelected}
        locked={locked}
        {...props}
      >
        <IconContainer hasSelected={hasSelected} locked={locked}>
          {icon}
        </IconContainer>
        <Content>{children}</Content>
        {hasSelected &&
          !locked &&
          allowClear && (
            <StyledClose
              src="icon-close"
              locked={locked}
              hasSelected={hasSelected}
              onClick={this.handleClear}
            />
          )}
        {!locked && (
          <StyledChevron
            isOpen={isOpen}
            hasChanges={hasChanges}
            onClick={this.handleChevronClick}
          >
            <InlineSvg src="icon-chevron-down" />
          </StyledChevron>
        )}
        {locked && (
          <Tooltip
            title={lockedMessage || 'This selection is locked'}
            tooltipOptions={{
              placement: 'bottom',
            }}
          >
            <StyledLock src="icon-lock" />
          </Tooltip>
        )}
      </StyledHeaderItem>
    );
  }
}

const getColor = p => {
  if (p.locked) {
    return p.theme.gray2;
  }
  return p.isOpen || p.hasSelected ? p.theme.gray4 : p.theme.gray2;
};

const StyledHeaderItem = styled('div')`
  display: flex;
  padding: 0 ${space(4)};
  align-items: center;
  cursor: ${p => (p.locked ? 'text' : 'pointer')};
  color: ${getColor};
  transition: 0.1s color;
  user-select: none;
`;

const Content = styled('div')`
  flex: 1;
  margin-right: ${space(1.5)};
  ${overflowEllipsis};
`;

const IconContainer = styled('span')`
  color: ${getColor};
  margin-right: ${space(1.5)};
`;

const StyledClose = styled(InlineSvg)`
  color: ${getColor};
  height: ${space(1.5)};
  width: ${space(1.5)};
  stroke-width: 1.5;
  padding: ${space(1)};
  box-sizing: content-box;
  margin: -${space(1)} 0px -${space(1)} -${space(1)};
`;

const StyledChevron = styled('div')`
  transform: rotate(${p => (p.isOpen ? '180deg' : '0deg')});
  transition: 0.1s all;
  width: ${space(2)};
  height: ${space(2)};
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

const StyledLock = styled(InlineSvg)`
  color: ${p => p.theme.gray2};
  width: ${space(2)};
  height: ${space(2)};
  stroke-width: 1.5;
`;

export default React.forwardRef((props, ref) => <HeaderItem {...props} innerRef={ref} />);
