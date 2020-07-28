import {css} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styled from '@emotion/styled';

import space from 'app/styles/space';

// exporting it down with alertStyles caused error  'Props' is not defined  no-undef
export type Props = {
  type?: 'muted' | 'info' | 'warning' | 'success' | 'error' | 'beta';
  icon?: React.ReactNode;
  system?: boolean;
};

type AlertProps = Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props;

type AlertThemeProps = {
  backgroundLight: string;
  border: string;
  iconColor: string;
};

const DEFAULT_TYPE = 'info';

const getAlertColorStyles = ({
  backgroundLight,
  border,
  iconColor,
}: AlertThemeProps) => css`
  background: ${backgroundLight};
  border: 1px solid ${border};
  svg {
    color: ${iconColor};
  }
`;

const getSystemAlertColorStyles = ({
  backgroundLight,
  border,
  iconColor,
}: AlertThemeProps) => css`
  background: ${backgroundLight};
  border: 0;
  border-radius: 0;
  border-bottom: 1px solid ${border};
  svg {
    color: ${iconColor};
  }
`;

const alertStyles = ({theme, type = DEFAULT_TYPE, system}: Props & {theme: any}) => css`
  display: flex;
  margin: 0 0 ${space(3)};
  padding: ${space(1.5)} ${space(2)};
  font-size: 15px;
  box-shadow: ${theme.dropShadowLight};
  border-radius: ${theme.borderRadius};
  background: ${theme.gray100};
  border: 1px solid ${theme.borderDark};

  a:not([role='button']) {
    color: ${theme.textColor};
    border-bottom: 1px dotted ${theme.textColor};
  }

  ${getAlertColorStyles(theme.alert[type])};
  ${system && getSystemAlertColorStyles(theme.alert[type])};
`;

const IconWrapper = styled('span')`
  display: flex;
  margin-right: ${space(1)};

  /* Give the wrapper an explicit height so icons are line height with the
   * (common) line height. */
  height: 22px;
  align-items: center;
`;

const StyledTextBlock = styled('span')`
  line-height: 1.5;
  flex-grow: 1;
  position: relative;
  margin: auto;
`;

const Alert = styled(
  ({
    type,
    icon,
    children,
    className,
    system: _system, // don't forward to `div`
    ...props
  }: AlertProps) => {
    return (
      <div className={classNames(type ? `ref-${type}` : '', className)} {...props}>
        {icon && <IconWrapper>{icon}</IconWrapper>}
        <StyledTextBlock>{children}</StyledTextBlock>
      </div>
    );
  }
)<AlertProps>`
  ${alertStyles}
`;

Alert.propTypes = {
  type: PropTypes.oneOf(['muted', 'info', 'warning', 'success', 'error', 'beta']),
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  system: PropTypes.bool,
};

Alert.defaultProps = {
  type: DEFAULT_TYPE,
};

export {alertStyles};

export default Alert;
