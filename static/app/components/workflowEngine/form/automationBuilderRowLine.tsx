import styled from '@emotion/styled';

export const RowLine = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  flex-wrap: wrap;
  flex: 1;
`;

export const OptionalRowLine = styled(RowLine)`
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  padding-top: ${p => p.theme.space.md};
`;
