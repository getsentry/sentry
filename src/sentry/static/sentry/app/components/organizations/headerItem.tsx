import {Link} from 'react-router';
import React from 'react';
import PropTypes from 'prop-types';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {IconChevron, IconClose, IconLock, IconSettings} from 'app/icons';
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
  loading: boolean;
  forwardRef?: React.Ref<HTMLDivElement>;
  onClear: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

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
      children,
      isOpen,
      hasSelected,
      allowClear,
      icon,
      locked,
      lockedMessage,
      settingsLink,
      onClear, // eslint-disable-line no-unused-vars
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
      <StyledHeaderItem ref={forwardRef} loading={loading} {...props} {...textColorProps}>
        <IconContainer {...textColorProps}>{icon}</IconContainer>
        <Content>{children}</Content>
        {hasSelected && !locked && allowClear && (
          <StyledIconClose {...textColorProps} onClick={this.handleClear} />
        )}
        {settingsLink && (
          <SettingsIconLink to={settingsLink}>
            <IconSettings />
          </SettingsIconLink>
        )}
        {!locked && !loading && (
          <StyledChevron isOpen={isOpen}>
            <IconChevron direction="down" />
          </StyledChevron>
        )}
        {locked && (
          <Tooltip title={lockedMessage || 'This selection is locked'} position="bottom">
            <StyledIconLock />
          </Tooltip>
        )}
      </StyledHeaderItem>
    );
  }
}

// Infer props here because of styled/theme
const getColor = p => {
  if (p.locked) {
    return p.theme.gray2;
  }
  return p.isOpen || p.hasSelected ? p.theme.gray4 : p.theme.gray2;
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
  display: flex;
  color: ${getColor};
  margin-right: ${space(1.5)};
`;

const StyledIconClose = styled(IconClose, {shouldForwardProp: isPropValid})<ColorProps>`
  color: ${getColor};
  padding: ${space(1)};
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

const StyledIconLock = styled(IconLock)`
  color: ${p => p.theme.gray2};
`;

const StyledChevron = styled('div')<Pick<ColorProps, 'isOpen'>>`
  transform: rotate(${p => (p.isOpen ? '180deg' : '0deg')});
  transition: 0.1s all;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default React.forwardRef<HTMLDivElement, Props>((props, ref) => (
  <HeaderItem forwardRef={ref} {...props} />
));
