import styled from '@emotion/styled';

import {chonkFor} from 'sentry/components/core/chonk';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onClick'> {
  ref?: React.Ref<HTMLInputElement>;
  size?: 'sm' | 'lg';
}

const toggleWrapperSize = {
  sm: {width: 36, height: 20},
  lg: {width: 40, height: 24},
};

const toggleButtonSize = {
  sm: {width: 20, height: 20, icon: 14, iconOffset: 2},
  lg: {width: 24, height: 24, icon: 16, iconOffset: 3},
};

/** We inject hex colors as background image, which requires escaping the hex characters */
function urlEscapeHex(hex: string) {
  return hex.replace(/#/g, '%23');
}

const NativeHiddenCheckbox = styled('input')<{
  nativeSize: NonNullable<SwitchProps['size']>;
}>`
  position: absolute;
  opacity: 0;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;

  &:focus-visible + div {
    ${p => p.theme.focusRing()};
  }

  + div {
    border-radius: ${p => p.theme.radius.sm};
    pointer-events: none;

    background: ${p => p.theme.colors.surface200};
    border-top: 3px solid ${p => p.theme.colors.surface100};
    border-right: 1px solid ${p => p.theme.colors.surface100};
    border-bottom: 1px solid ${p => p.theme.colors.surface100};
    border-left: 1px solid ${p => p.theme.colors.surface100};
    transition: all 100ms ease-in-out;

    > div {
      border-radius: ${p => p.theme.radius.sm};
      background: ${p => p.theme.colors.surface500};
      border: 1px solid ${p => p.theme.colors.surface100};

      width: ${p => toggleButtonSize[p.nativeSize].width}px;
      height: ${p => toggleButtonSize[p.nativeSize].height}px;
      position: absolute;
      top: 0;
      left: 0;
      transform: translateY(-1px);
      transition:
        all ${p => p.theme.motion.smooth.moderate},
        transform ${p => p.theme.motion.exit.slow};

      &:after {
        /** The icon is not clickable */
        pointer-events: none;
        position: absolute;
        content: '';
        display: block;
        width: ${p => toggleButtonSize[p.nativeSize].icon}px;
        height: ${p => toggleButtonSize[p.nativeSize].icon}px;
        top: ${p => toggleButtonSize[p.nativeSize].iconOffset}px;
        left: ${p => toggleButtonSize[p.nativeSize].iconOffset}px;
        background-repeat: no-repeat;
        background-size: ${p => toggleButtonSize[p.nativeSize].icon}px
          ${p => toggleButtonSize[p.nativeSize].icon}px;
        transition: transform ${p => p.theme.motion.snap.slow};
        /* stylelint-disable */
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"><path fill="${p =>
          urlEscapeHex(
            p.theme.tokens.content.muted
          )}" d="M5.03 3.97a.75.75 0 0 0-1.06 1.06L6.94 8l-2.97 2.97a.75.75 0 1 0 1.06 1.06L8 9.06l2.97 2.97a.75.75 0 1 0 1.06-1.06L9.06 8l2.97-2.97a.75.75 0 0 0-1.06-1.06L8 6.94 5.03 3.97Z" clip-rule="evenodd"/></svg>');
        /* stylelint-enable */
      }
    }
  }

  &:checked + div {
    background: ${p => p.theme.colors.chonk.blue400};
    border-top: 3px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
    border-right: 1px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
    border-bottom: 1px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
    border-left: 1px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};

    > div {
      background: ${p => p.theme.colors.surface500};
      border: 1px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
      transform: translateY(-1px)
        translateX(
          ${p =>
            toggleWrapperSize[p.nativeSize].width -
            toggleButtonSize[p.nativeSize].width}px
        );

      &:after {
        /* stylelint-disable */
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"><path fill="${p =>
          urlEscapeHex(
            p.theme.tokens.content.accent
          )}" fill-rule="evenodd" d="M13.53 4.22c.3.3.3.77 0 1.06l-6.5 6.5a.75.75 0 0 1-1.08-.02l-3.5-3.75A.75.75 0 0 1 3.55 7l2.97 3.18 5.95-5.95c.3-.3.77-.3 1.06 0Z" clip-rule="evenodd"/></svg>');
        /* stylelint-enable */
      }
    }
  }

  &:disabled {
    cursor: not-allowed;

    + div {
      opacity: 0.6;

      > div {
        transform: translateY(0px) translateX(0px);
      }
    }
  }

  &:checked:disabled + div > div {
    transform: translateY(0px) translateX(16px);
  }
`;

const FakeCheckbox = styled('div')<{
  size: NonNullable<SwitchProps['size']>;
}>`
  width: ${p => toggleWrapperSize[p.size].width}px;
  height: ${p => toggleWrapperSize[p.size].height}px;
`;

const FakeCheckboxButton = styled('div')``;

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
