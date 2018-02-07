import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';
import TextBlock from '../views/settings/components/text/textBlock';
import InlineSvg from './inlineSvg';

const AlertWrapper = styled.div`
  margin: 0 0 ${p => p.theme.grid * 3}px;
  padding: ${p => p.theme.grid * 2}px;
  font-size: 15px;
  box-shadow: ${p => p.theme.dropShadowLight};
  display: flex;

  svg {
  }

  ${p => {
    switch (p.type) {
      case 'info':
        return css`
          background: ${p.theme.alert.info.backgroundLight};
          border: 1px solid ${p.theme.alert.info.border};
          svg {
            color: ${p.theme.blue};
          }
        `;
      case 'warning':
        return css`
          background: ${p.theme.alert.warning.backgroundLight};
          border: 1px solid ${p.theme.alert.warning.border};
          svg {
            color: ${p.theme.yellowDark};
          }
        `;
      case 'success':
        return css`
          background: ${p.theme.alert.success.backgroundLight};
          border: 1px solid ${p.theme.alert.success.border};
          svg {
            color: ${p.theme.greenDark};
          }
        `;
      case 'error':
        return css`
          background: ${p.theme.alert.error.background};
          border: 1px solid ${p.theme.alert.error.border};
          svg {
            color: ${p.theme.redDark};
          }
        `;
      default:
        return css`
          background: ${p.theme.whiteDark};
          border: 1px solid ${p.theme.borderDark};
        `;
    }
  }};
`;

const TextBlockStyled = styled(TextBlock)`
  line-height: 1.4;
  margin-bottom: 0;
  flex: 1;
  align-self: center;
`;

const InlineSvgStyled = styled(InlineSvg)`
  margin-right: 12px;
`;

const Alert = ({type, icon, children, ...props}) => {
  return (
    <AlertWrapper type={type} {...props}>
      {icon && <InlineSvgStyled src={icon} size="24px" />}
      <TextBlockStyled>{children}</TextBlockStyled>
    </AlertWrapper>
  );
};

Alert.propTypes = {
  type: PropTypes.string,
  icon: PropTypes.string,
};

export default Alert;
