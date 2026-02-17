import styled from '@emotion/styled';

const ToolbarHeader = styled('div')`
  font-size: 12px;
  text-transform: uppercase;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
`;

export default ToolbarHeader;
