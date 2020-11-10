import {Link} from 'react-router';
import React from 'react';
import PropTypes from 'prop-types';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {IconClose, IconLock, IconChevron, IconInfo, IconSettings} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type DefaultProps = {
  allowClear: boolean;
};

type Props = {
  icon: React.ReactElement;
  hasChanges: boolean;
  hasSelected: boolean;
  isOpen: boolean;
  locked: boolean;
  loading: boolean;
  hint?: string;
  settingsLink?: string;
  lockedMessage?: React.ReactNode;
  forwardRef?: React.Ref<HTMLDivElement>;
  onClear?: () => void;
} & Partial<DefaultProps> &
  React.HTMLAttributes<HTMLDivElement>;

class HeaderItem extends React.Component<Props> {
  static propTypes = {
    icon: PropTypes.element,
    onClear: PropTypes.func,
    hasChanges: PropTypes.bool,
    hasSelected: PropTypes.bool,
    isOpen: PropTypes.bool,
    locked: PropTypes.bool,
    lockedMessage: PropTypes.element,
    settingsLink: PropTypes.string,
    hint: PropTypes.string,
  };

  static defaultProps: DefaultProps = {
    allowClear: true,
  };

  handleClear = e => {
    e.stopPropagation();
    this.props.onClear?.();
  };

  render() {
    const {
      children,
      isOpen,
      hasSelected,
      allowClear,
      icon,
      locked,
      lockedMessage,
      settingsLink,
      hint,
      loading,
      forwardRef,
      ...props
    } = this.props;

    const textColorProps = {
      locked,
      isOpen,
      hasSelected,
    };

    return (
      <StyledHeaderItem
        ref={forwardRef}
        loading={loading}
        {...omit(props, 'onClear')}
        {...textColorProps}
      >
        <IconContainer {...textColorProps}>{icon}</IconContainer>
        <Content>{children}</Content>
        {hint && (
          <Hint>
            <Tooltip title={hint} position="bottom">
              <IconInfo size="sm" />
            </Tooltip>
          </Hint>
        )}
        {hasSelected && !locked && allowClear && (
          <StyledClose {...textColorProps} onClick={this.handleClear} />
        )}
        {settingsLink && (
          <SettingsIconLink to={settingsLink}>
            <IconSettings />
          </SettingsIconLink>
        )}
        {!locked && !loading && (
          <StyledChevron isOpen={isOpen}>
            <IconChevron
              direction="down"
              color={isOpen ? 'gray700' : 'gray500'}
              size="sm"
            />
          </StyledChevron>
        )}
        {locked && (
          <Tooltip title={lockedMessage || 'This selection is locked'} position="bottom">
            <StyledLock color="gray500" />
          </Tooltip>
        )}
      </StyledHeaderItem>
    );
  }
}

// Infer props here because of styled/theme
const getColor = p => {
  if (p.locked) {
    return p.theme.gray500;
  }
  return p.isOpen || p.hasSelected ? p.theme.gray700 : p.theme.gray500;
};

type ColorProps = {
  locked: boolean;
  isOpen: boolean;
  hasSelected: boolean;
};

const StyledHeaderItem = styled('div', {
  shouldForwardProp: p => isPropValid(p) && p !== 'loading',
})<
  ColorProps & {
    loading: boolean;
  }
>`
  display: flex;
  padding: 0 ${space(4)};
  align-items: center;
  cursor: ${p => (p.loading ? 'progress' : p.locked ? 'text' : 'pointer')};
  color: ${getColor};
  transition: 0.1s color;
  user-select: none;
`;

const Content = styled('div')`
  flex: 1;
  margin-right: ${space(1.5)};
  ${overflowEllipsis};
`;

const IconContainer = styled('span', {shouldForwardProp: isPropValid})<ColorProps>`
  color: ${getColor};
  margin-right: ${space(1.5)};
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Hint = styled('div')`
  position: relative;
  top: ${space(0.25)};
  margin-right: ${space(1)};
`;

const StyledClose = styled(IconClose, {shouldForwardProp: isPropValid})<ColorProps>`
  color: ${getColor};
  height: ${space(1.5)};
  width: ${space(1.5)};
  stroke-width: 1.5;
  padding: ${space(1)};
  box-sizing: content-box;
  margin: -${space(1)} 0px -${space(1)} -${space(1)};
`;

type StyledChevronProps = Pick<ColorProps, 'isOpen'>;
const StyledChevron = styled('div')<StyledChevronProps>`
  transform: rotate(${p => (p.isOpen ? '180deg' : '0deg')});
  transition: 0.1s all;
  width: ${space(2)};
  height: ${space(2)};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SettingsIconLink = styled(Link)`
  color: ${p => p.theme.gray500};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)};
  transition: 0.5s opacity ease-out;

  &:hover {
    color: ${p => p.theme.gray700};
  }
`;

const StyledLock = styled(IconLock)`
  margin-top: ${space(0.75)};
  stroke-width: 1.5;
`;

export default React.forwardRef<HTMLDivElement, Props>((props, ref) => (
  <HeaderItem forwardRef={ref} {...props} />
));
