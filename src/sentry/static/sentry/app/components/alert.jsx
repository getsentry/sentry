import {css, cx} from 'emotion';
import PropTypes from 'prop-types';
import React from 'react';
import color from 'color';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import TextBlock from 'app/views/settings/components/text/textBlock';
import isPropValid from '@emotion/is-prop-valid';
import space from 'app/styles/space';

const StyledInlineSvg = styled(InlineSvg)`
  margin-right: calc(${p => p.size} / 2);
`;

const getAlertColorStyles = ({backgroundLight, border, iconColor}) => `
  background: ${backgroundLight};
  border: 1px solid ${border};

  svg {
    color: ${iconColor};
  }
`;

const getSystemAlertColorStyles = ({backgroundLight, border, iconColor}) => `
  border: 0;
  border-radius: 0;
  border-bottom: 1px solid ${color(border)
    .alpha(0.5)
    .string()};

  ${StyledInlineSvg} {
    color: ${iconColor};
  }
`;

const alertStyles = ({theme, type, system}) => css`
  display: flex;
  margin: 0 0 ${space(3)};
  padding: ${space(2)};
  font-size: 15px;
  box-shadow: ${theme.dropShadowLight};
  border-radius: ${theme.borderRadius};
  background: ${theme.whiteDark};
  border: 1px solid ${theme.borderDark};
  align-items: center;

  a {
    color: ${theme.textColor};
    border-bottom: 1px dotted ${theme.textColor};
  }

  ${getAlertColorStyles(theme.alert[type])};
  ${system && getSystemAlertColorStyles(theme.alert[type])};
`;

const AlertWrapper = styled('div', {shouldForwardProp: isPropValid})`
  ${alertStyles}
`;

const StyledTextBlock = styled(TextBlock)`
  line-height: 1.4;
  margin-bottom: 0;
  flex: 1;
  align-self: center;
`;

const Alert = ({type, icon, iconSize, children, className, ...props}) => {
  let refClass;

  if (type) {
    refClass = 'ref-' + type;
  }

  return (
    <AlertWrapper type={type} {...props} className={cx(refClass, className)}>
      {icon && <StyledInlineSvg src={icon} size={iconSize} />}
      <StyledTextBlock>{children}</StyledTextBlock>
    </AlertWrapper>
  );
};

Alert.propTypes = {
  type: PropTypes.string,
  icon: PropTypes.string,
  iconSize: PropTypes.string,
};

Alert.defaultProps = {
  iconSize: '24px',
  type: 'info',
};

export {alertStyles};

export default Alert;
