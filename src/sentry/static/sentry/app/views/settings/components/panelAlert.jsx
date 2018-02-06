import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';
import TextBlock from './text/textBlock';

const PanelAlertWrapper = styled.div`
  margin: -17px -17px 30px;
  padding: 16px;
  font-size: 14px;

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

const PanelAlert = ({type, children}) => {
  return (
    <PanelAlertWrapper type={type}>
      <TextBlockStyled>{children}</TextBlockStyled>
    </PanelAlertWrapper>
  );
};

PanelAlert.propTypes = {
  type: PropTypes.string,
};

export default PanelAlert;
