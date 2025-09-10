import styled from '@emotion/styled';

const OverChartButtonGroup = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.xs};
  justify-content: space-between;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    justify-content: flex-end;
    margin-bottom: ${p => p.theme.space.md};
  }
`;

export {OverChartButtonGroup};
