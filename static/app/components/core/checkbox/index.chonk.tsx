import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

export const ChonkNativeHiddenCheckbox = chonkStyled('input')`
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
    color: ${p => p.theme.colors.static.white};
    border: 1px solid ${p => p.theme.colors.dynamic.surface100};

    svg {
      stroke: ${p => p.theme.colors.static.white};
    }
  }

  &:focus-visible + * {
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.colors.dynamic.surface100},
      0 0 0 4px ${p => p.theme.focusBorder};
  }

  &:disabled + *,
  &[aria-disabled='true'] + * {
    background-color: ${p => p.theme.colors.dynamic.surface500};
    border: 1px solid ${p => p.theme.colors.dynamic.surface100};
    cursor: not-allowed;
  }

  &:checked + *,
  &:indeterminate + * {
    background-color: ${p => p.theme.colors.static.blue400};
    color: ${p => p.theme.white};
  }

  &:disabled:checked + *,
  &:disabled:indeterminate + * {
    background-color: ${p => p.theme.colors.static.blue400};
    border: 1px solid ${p => p.theme.colors.static.blue400};
  }
`;
