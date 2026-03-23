import styled from '@emotion/styled';

/**
 * A button with all default browser styling removed.
 * Use when wrapping a Container or other visual primitive that
 * provides its own appearance but needs click/keyboard semantics.
 */
export const ScmCardButton = styled('button')`
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  width: 100%;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;
