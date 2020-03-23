import {css} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import color from 'color';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import TextBlock from 'app/views/settings/components/text/textBlock';
import space from 'app/styles/space';

// exporting it down with alertStyles caused error  'Props' is not defined  no-undef
export type Props = {
  type?: 'muted' | 'info' | 'warning' | 'success' | 'error' | 'beta';
  iconSize?: string;
  icon?: string | React.ReactNode;
  alignTop?: boolean;
  system?: boolean;
  thinner?: boolean;
};

type AlertProps = Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props;

type AlertThemeProps = {
  backgroundLight: string;
  border: string;
  iconColor: string;
};

const DEFAULT_TYPE = 'info';

const IconWrapper = styled('span')`
  display: flex;
  margin-right: ${space(1.5)};
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
  svg {
    color: ${iconColor};
  }
`;

const alertStyles = ({
  theme,
  type = DEFAULT_TYPE,
  system,
  alignTop,
  thinner,
}: Props & {theme: any}) => css`
  display: flex;
  margin: 0 0 ${space(3)};
  padding: ${space(thinner ? 1 : 2)};
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
  align-self: center;
  width: 100%;
`;

const Alert = styled(
  ({type, icon, iconSize, children, className, ...props}: AlertProps) => (
    <div className={classNames(type ? `ref-${type}` : '', className)} {...props}>
      {icon && (
        <IconWrapper>
          {typeof icon === 'string' ? <InlineSvg src={icon} size={iconSize!} /> : icon}
        </IconWrapper>
      )}
      <StyledTextBlock>{children}</StyledTextBlock>
    </div>
  )
)<AlertProps>`
  ${alertStyles}
`;

Alert.propTypes = {
  type: PropTypes.oneOf(['muted', 'info', 'warning', 'success', 'error', 'beta']),
  iconSize: PropTypes.string,
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  alignTop: PropTypes.bool,
  system: PropTypes.bool,
  thinner: PropTypes.bool,
};

Alert.defaultProps = {
  type: DEFAULT_TYPE,
  iconSize: '24px',
};

export {alertStyles};

export default Alert;
