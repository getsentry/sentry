import React from 'react';
import PropTypes from 'prop-types';
import {cx} from 'emotion';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';
import TextBlock from 'app/views/settings/components/text/textBlock';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

const StyledInlineSvg = styled(InlineSvg)`
  margin-right: calc(${p => p.size} / 2);
`;

const getAlertColorStyles = ({backgroundLight, border, iconColor}, textColor) => `
  background: ${backgroundLight};
  border: 1px solid ${border};

  svg {
    color: ${iconColor};
  }

  a {
    color: ${textColor};
    border-bottom: 1px dotted ${textColor};
  }
`;

const getSystemAlertColorStyles = ({background}) => `
  background: ${background};
  border: 0;
  border-radius: 0;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 1px 1px rgba(0,0,0, .15);

  ${StyledInlineSvg} {
    color: #fff;
  }

  a {
    color: #fff;
    border-bottom: 1px dotted rgba(255,255,255, .8);

    &:hover {
      border-bottom: 1px dotted rgba(255,255,255, 1);
    }
  }
`;

const AlertWrapper = styled(Flex)`
  margin: 0 0 ${space(3)};
  padding: ${space(2)};
  font-size: 15px;
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.whiteDark};
  border: 1px solid ${p => p.theme.borderDark};

  ${p =>
    p.system
      ? p.type && getSystemAlertColorStyles(p.theme.alert[p.type])
      : p.type && getAlertColorStyles(p.theme.alert[p.type], p.theme.gray5)};
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
