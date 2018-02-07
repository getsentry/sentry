import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';
import TextBlock from '../views/settings/components/text/textBlock';

const AlertWrapper = styled.div`
  margin: 0 0 ${p => p.theme.grid * 3}px;
  padding: ${p => p.theme.grid * 2}px;
  font-size: 14px;
  box-shadow: ${p => p.theme.dropShadowLight};

  ${p => {
    switch (p.type) {
      case 'info':
        return css`
          background: ${p.theme.alert.info.backgroundLight};
          border: 1px solid ${p.theme.alert.info.border};
        `;
      case 'warning':
        return css`
          background: ${p.theme.alert.warning.backgroundLight};
          border: 1px solid ${p.theme.alert.warning.border};
        `;
      case 'success':
        return css`
          background: ${p.theme.alert.success.backgroundLight};
          border: 1px solid ${p.theme.alert.success.border};
        `;
      case 'error':
        return css`
          background: ${p.theme.alert.error.background};
          border: 1px solid ${p.theme.alert.error.border};
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
  margin-bottom: 0;
`;

const Alert = ({type, children, ...props}) => {
  return (
    <AlertWrapper type={type} {...props}>
      <TextBlockStyled>{children}</TextBlockStyled>
    </AlertWrapper>
  );
};

Alert.propTypes = {
  type: PropTypes.string,
};

export default Alert;
