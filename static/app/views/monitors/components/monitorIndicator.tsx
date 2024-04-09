import styled from '@emotion/styled';

const MonitorIndicator = styled('div')<{
  size: number;
  status: 'success' | 'warning' | 'error' | 'disabled';
}>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  background: ${p => p.theme[p.status]};
`;

export {MonitorIndicator};
