import styled from '@emotion/styled';

// TODO(health): health status according to crash free percent will be calculated
// elsewhere (if at all), this is just for demonstration purposes

const HealthStatus = styled('span')<{crashFreePercent: number}>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-block;
  background-color: ${p => {
    if (p.crashFreePercent < 33) {
      return p.theme.red;
    }
    if (p.crashFreePercent < 66) {
      return p.theme.yellowOrange;
    }
    return p.theme.green;
  }};
`;

export default HealthStatus;
