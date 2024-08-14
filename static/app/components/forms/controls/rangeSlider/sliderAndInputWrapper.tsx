import styled from '@emotion/styled';

const SliderAndInputWrapper = styled('div')<{showCustomInput?: boolean}>`
  display: grid;
  align-items: center;
  grid-auto-flow: column;
  grid-template-columns: 4fr ${p => p.showCustomInput && '1fr'};
  gap: ${p => p.theme.space(1)};
`;

export default SliderAndInputWrapper;
