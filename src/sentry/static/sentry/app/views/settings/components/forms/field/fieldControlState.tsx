import styled from '@emotion/styled';

const width = '36px';
const FieldControlState = styled('div')<{flexibleControlStateSize?: boolean}>`
  display: flex;
  position: relative;
  ${p => !p.flexibleControlStateSize && `width: ${width}`};
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
`;

export default FieldControlState;
