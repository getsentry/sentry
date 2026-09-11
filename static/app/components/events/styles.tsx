import styled from '@emotion/styled';

export const DataSection = styled('div')`
  display: flex;
  flex-direction: column;
  margin: 0;

  /* Padding aligns with Layout.Body */
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

  @container (min-width: ${p => p.theme.container['3xl']}) {
    padding: ${p => p.theme.space.lg} ${p => p.theme.space['3xl']};
  }
`;
