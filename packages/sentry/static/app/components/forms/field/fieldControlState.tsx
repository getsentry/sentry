import styled from '@emotion/styled';

const width = '36px';

const FieldControlState = styled('div')<{
  /**
   * Do not apply a width to the control state container, allowing it to flex
   * based on its parents constraints.
   */
  flexibleControlStateSize?: boolean;
}>`
  display: flex;
  position: relative;
  ${p => !p.flexibleControlStateSize && `width: ${width}`};
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
`;

export default FieldControlState;
