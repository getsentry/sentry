import React from 'react';
import PropTypes from 'prop-types';
import {cx} from 'emotion';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';
import Color from 'color';

import TextBlock from 'app/views/settings/components/text/textBlock';
import InlineSvg from 'app/components/inlineSvg';
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
  border-bottom: 1px solid ${Color(border)
    .alpha(0.5)
    .string()};

  ${StyledInlineSvg} {
    color: ${iconColor};
  }
`;

const AlertWrapper = styled('div', {shouldForwardProp: isPropValid})`
  display: flex;
  margin: 0 0 ${space(3)};
  padding: ${space(2)};
  font-size: 15px;
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.whiteDark};
  border: 1px solid ${p => p.theme.borderDark};
  align-items: center;

  a {
    color: ${p => p.theme.textColor};
    border-bottom: 1px dotted ${p => p.theme.textColor};
  }

  ${p => getAlertColorStyles(p.theme.alert[p.type])} ${p =>
      p.system && getSystemAlertColorStyles(p.theme.alert[p.type])};
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
};

export default Alert;
