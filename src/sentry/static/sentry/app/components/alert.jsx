import React from 'react';
import PropTypes from 'prop-types';
import {cx} from 'emotion';
import styled from 'react-emotion';
import TextBlock from '../views/settings/components/text/textBlock';
import InlineSvg from './inlineSvg';

const getAlertColorStyles = ({backgroundLight, border, iconColor}) => `
  background: ${backgroundLight};
  border: 1px solid ${border};
  svg {
    color: ${iconColor};
  }
`;

const AlertWrapper = styled.div`
  margin: 0 0 ${p => p.theme.grid * 3}px;
  padding: ${p => p.theme.grid * 2}px;
  font-size: 15px;
  box-shadow: ${p => p.theme.dropShadowLight};
  display: flex;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.whiteDark};
  border: 1px solid ${p => p.theme.borderDark};

  ${p => p.type && getAlertColorStyles(p.theme.alert[p.type])};
`;

const StyledTextBlock = styled(TextBlock)`
  line-height: 1.4;
  margin-bottom: 0;
  flex: 1;
  align-self: center;
`;

const StyledInlineSvg = styled(InlineSvg)`
  margin-right: 12px;
`;

const Alert = ({type, icon, children, className, ...props}) => {
  let refClass;

  if (type) {
    refClass = 'ref-' + type;
  }

  return (
    <AlertWrapper type={type} {...props} className={cx(refClass, className)}>
      {icon && <StyledInlineSvg src={icon} size="24px" />}
      <StyledTextBlock>{children}</StyledTextBlock>
    </AlertWrapper>
  );
};

Alert.propTypes = {
  type: PropTypes.string,
  icon: PropTypes.string,
};

export default Alert;
