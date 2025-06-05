import styled from '@emotion/styled';

export const ChartContainer = styled('div')<{height?: string | number}>`
  min-height: 220px;
  height: ${p =>
    p.height ? (typeof p.height === 'string' ? p.height : `${p.height}px`) : '220px'};
`;

export const ModalChartContainer = styled('div')`
  height: 360px;
`;
