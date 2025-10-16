import styled from '@emotion/styled';

export const OverChartButtonGroup = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.xs};
  justify-content: space-between;
  margin-bottom: ${p => p.theme.space.md};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    justify-content: flex-end;
  }
`;
