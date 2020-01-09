import {css} from 'emotion';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import color from 'color';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import TextBlock from 'app/views/settings/components/text/textBlock';
import space from 'app/styles/space';

// exporting it down with alertStyles caused error  'Props' is not defined  no-undef
export type Props = {
  type?: 'muted' | 'info' | 'warning' | 'success' | 'error' | 'beta';
  iconSize?: string;
  icon?: string;
  alignTop?: boolean;
  system?: boolean;
};

type AlertProps = Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props;

type AlertThemeProps = {
  backgroundLight: string;
  border: string;
  iconColor: string;
};

const DEFAULT_TYPE = 'info';

const StyledInlineSvg = styled(InlineSvg)<{size: string}>`
  margin-right: calc(${p => p.size} / 2);
`;

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

const getSystemAlertColorStyles = ({border, iconColor}: AlertThemeProps) => css`
  border: 0;
  border-radius: 0;
  border-bottom: 1px solid
    ${color(border)
      .alpha(0.5)
      .string()};

  ${StyledInlineSvg} {
    color: ${iconColor};
  }
`;

const alertStyles = ({
  theme,
  type = DEFAULT_TYPE,
  system,
  alignTop,
}: Props & {theme: any}) => css`
  display: flex;
  margin: 0 0 ${space(3)};
  padding: ${space(2)};
  font-size: 15px;
  box-shadow: ${theme.dropShadowLight};
  border-radius: ${theme.borderRadius};
  background: ${theme.whiteDark};
  border: 1px solid ${theme.borderDark};
  align-items: ${alignTop ? 'top' : 'center'};

  a:not([role='button']) {
    color: ${theme.textColor};
    border-bottom: 1px dotted ${theme.textColor};
  }

  ${getAlertColorStyles(theme.alert[type])};
  ${system && getSystemAlertColorStyles(theme.alert[type])};
`;

const StyledTextBlock = styled(TextBlock)`
  line-height: 1.4;
  margin-bottom: 0;
  flex: 1;
  align-self: center;
`;

const Alert = styled(
  ({type, icon, iconSize, children, system, className, ...props}: AlertProps) => (
    <div className={classNames(type ? `ref-${type}` : '', className)} {...props}>
      {icon && <StyledInlineSvg src={icon} size={iconSize!} />}
      <StyledTextBlock>{children}</StyledTextBlock>
    </div>
  )
)<AlertProps>`
  ${alertStyles}
`;

Alert.propTypes = {
  type: PropTypes.oneOf(['muted', 'info', 'warning', 'success', 'error', 'beta']),
  iconSize: PropTypes.string,
  icon: PropTypes.string,
  alignTop: PropTypes.bool,
  system: PropTypes.bool,
};

Alert.defaultProps = {
  type: DEFAULT_TYPE,
  iconSize: '24px',
};

export {alertStyles};

export default Alert;
