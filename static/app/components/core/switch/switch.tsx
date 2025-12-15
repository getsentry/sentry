import styled from '@emotion/styled';

import * as ChonkSwitch from './switch.chonk';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onClick'> {
  ref?: React.Ref<HTMLInputElement>;
  size?: 'sm' | 'lg';
}

export function Switch({ref, size = 'sm', ...props}: SwitchProps) {
  return (
    <SwitchWrapper>
      {/* @TODO(jonasbadalic): if we name the prop size, it conflicts with the native input size prop,
       * so we need to use a different name, or somehow tell emotion to not create a type intersection.
       */}
      <NativeHiddenCheckbox ref={ref} type="checkbox" nativeSize={size} {...props} />
      <FakeCheckbox size={size}>
        <FakeCheckboxButton />
      </FakeCheckbox>
    </SwitchWrapper>
  );
}

const SwitchWrapper = styled('div')`
  position: relative;
  cursor: pointer;
  display: inline-flex;
  justify-content: flex-start;
`;

const NativeHiddenCheckbox = ChonkSwitch.ChonkNativeHiddenCheckbox;

const FakeCheckbox = ChonkSwitch.ChonkFakeCheckbox;

const FakeCheckboxButton = ChonkSwitch.ChonkFakeCheckboxButton;
