import styled from '@emotion/styled';

const PanelFooter = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: 14px;
`;

export default PanelFooter;
