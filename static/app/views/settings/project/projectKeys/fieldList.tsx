import styled from '@emotion/styled';

export const FieldList = styled('div')`
  > * {
    padding: ${p => p.theme.space.xl};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

    &:last-child {
      border-bottom: none;
    }
  }
`;
