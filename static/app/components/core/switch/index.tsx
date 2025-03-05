import {forwardRef} from 'react';
import styled from '@emotion/styled';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  size?: 'sm' | 'lg';
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({size = 'sm', ...props}: SwitchProps, ref) => {
    return (
      <SwitchWrapper>
        {/* @TODO(jonasbadalic): if we name the prop size, it conflicts with the native input size prop,
         * so we need to use a different name, or somehow tell emotion to not create a type intersection.
         */}
        <NativeHiddenCheckbox ref={ref} type="checkbox" nativeSize={size} {...props} />
        <FakeCheckbox size={size}>
          <FakeCheckboxButton size={size} />
        </FakeCheckbox>
      </SwitchWrapper>
    );
  }
);

const ToggleConfig = {
  sm: {
    size: 12,
    top: 1,
  },
  lg: {
    size: 16,
    top: 3,
  },
};

const ToggleWrapperSize = {
  sm: 16,
  lg: 24,
};

const SwitchWrapper = styled('div')`
  position: relative;
  cursor: pointer;
  display: inline-flex;
  justify-content: flex-start;
`;

const NativeHiddenCheckbox = styled('input')<{
  nativeSize: NonNullable<SwitchProps['size']>;
}>`
  position: absolute;
  opacity: 0;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  cursor: pointer;

  & + div {
    > div {
      background: ${p => p.theme.border};
      transform: translateX(${p => ToggleConfig[p.nativeSize].top}px);
    }
  }

  &:checked + div {
    > div {
      background: ${p => p.theme.active};
      transform: translateX(
        ${p => ToggleConfig[p.nativeSize].top + ToggleWrapperSize[p.nativeSize] * 0.875}px
      );
    }
  }

  &:focus + div,
  &:focus-visible + div {
    outline: none;
    border-color: ${p => p.theme.focusBorder};
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px;
  }

  &:disabled {
    cursor: not-allowed;

    + div {
      opacity: 0.4;
    }
  }
`;

const FakeCheckbox = styled('div')<{
  size: NonNullable<SwitchProps['size']>;
}>`
  position: relative;
  display: inline-block;
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset ${p => p.theme.dropShadowMedium};
  height: ${p => ToggleWrapperSize[p.size]}px;
  width: ${p => ToggleWrapperSize[p.size] * 1.875}px;
  border-radius: ${p => ToggleWrapperSize[p.size]}px;
  pointer-events: none;

  transition:
    border 0.1s,
    box-shadow 0.1s;
`;

const FakeCheckboxButton = styled('div')<{
  size: NonNullable<SwitchProps['size']>;
}>`
  position: absolute;
  transition: 0.25s all ease;
  border-radius: 50%;
  top: ${p => ToggleConfig[p.size].top}px;
  width: ${p => ToggleConfig[p.size].size}px;
  height: ${p => ToggleConfig[p.size].size}px;
`;
