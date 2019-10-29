import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Link} from 'react-router';

import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {
  icon: React.ReactElement;
  lockedMessage: string;
  settingsLink: string;
  allowClear: boolean;
  hasChanges: boolean;
  hasSelected: boolean;
  isOpen: boolean;
  locked: boolean;
  innerRef: React.Ref<HTMLDivElement>;
  onClear: () => void;
} & HTMLDivElement;

class HeaderItem extends React.Component<Props> {
  static propTypes = {
    allowClear: PropTypes.bool,
    icon: PropTypes.element,
    onClear: PropTypes.func,
    hasChanges: PropTypes.bool,
    hasSelected: PropTypes.bool,
    isOpen: PropTypes.bool,
    locked: PropTypes.bool,
    lockedMessage: PropTypes.string,
    settingsLink: PropTypes.string,
  };

  static defaultProps = {
    allowClear: true,
  };

  handleClear = e => {
    e.stopPropagation();
    this.props.onClear();
  };

  render() {
    const {
      className,
      children,
      isOpen,
      hasSelected,
      allowClear,
      icon,
      locked,
      lockedMessage,
      settingsLink,
      onClear, // eslint-disable-line no-unused-vars
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
        {hasSelected && !locked && allowClear && (
          <StyledClose
            src="icon-close"
            locked={locked}
            hasSelected={hasSelected}
            onClick={this.handleClear}
          />
        )}
        {settingsLink && (
          <SettingsIconLink to={settingsLink}>
            <SettingsIcon src="icon-settings" />
          </SettingsIconLink>
        )}
        {!locked && (
          <StyledChevron isOpen={isOpen}>
            <InlineSvg src="icon-chevron-down" />
          </StyledChevron>
        )}
        {locked && (
          <Tooltip title={lockedMessage || 'This selection is locked'} position="bottom">
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

const StyledChevron = styled('div')<{
  isOpen: boolean;
}>`
  transform: rotate(${p => (p.isOpen ? '180deg' : '0deg')});
  transition: 0.1s all;
  width: ${space(2)};
  height: ${space(2)};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SettingsIconLink = styled(Link)`
  color: ${p => p.theme.gray2};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)};
  transition: 0.5s opacity ease-out;

  &:hover {
    color: ${p => p.theme.gray4};
  }
`;

const SettingsIcon = styled(InlineSvg)`
  height: 16px;
  width: 16px;
`;

const StyledLock = styled(InlineSvg)`
  color: ${p => p.theme.gray2};
  width: ${space(2)};
  height: ${space(2)};
  stroke-width: 1.5;
`;

export default React.forwardRef((props: Props, ref: React.Ref<HTMLDivElement>) => (
  <HeaderItem {...props} innerRef={ref} />
));
