import styled from '@emotion/styled';

export const ChonkNativeHiddenCheckbox = styled('input')`
  position: absolute;
  opacity: 0;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  cursor: pointer;

  & + * {
    color: ${p => p.theme.colors.white};
    border: 1px solid ${p => p.theme.colors.surface100};

    svg {
      stroke: ${p => p.theme.colors.white};
    }
  }

  &:focus-visible + * {
    ${p => p.theme.focusRing()};
  }

  &:disabled + *,
  &[aria-disabled='true'] + * {
    background-color: ${p => p.theme.colors.surface500};
    border: 1px solid ${p => p.theme.colors.surface100};
    cursor: not-allowed;
  }

  &:checked + *,
  &:indeterminate + * {
    background-color: ${p => p.theme.colors.chonk.blue400};
    color: ${p => p.theme.white};
  }

  &:disabled:checked + *,
  &:disabled:indeterminate + * {
    background-color: ${p => p.theme.colors.chonk.blue400};
    border: 1px solid ${p => p.theme.colors.chonk.blue400};
    opacity: 0.6;
  }
`;
