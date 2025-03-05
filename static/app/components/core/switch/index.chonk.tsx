import type {SwitchProps} from 'sentry/components/core/switch';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

const ToggleWrapperSize = {
  sm: {width: 36, height: 20},
  lg: {width: 40, height: 24},
};

const ToggleButtonSize = {
  sm: {width: 20, height: 20, icon: 14, iconOffset: 2},
  lg: {width: 24, height: 24, icon: 16, iconOffset: 3},
};

/** We inject hex colors as background image, which requires escaping the hex characters */
function urlEscapeHex(hex: string) {
  return hex.replace('#', '%23');
}

export const ChonkNativeHiddenCheckbox = chonkStyled('input')<{
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
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.background}, 0 0 0 4px ${p => p.theme.focusBorder};
  }

  + div {
    border-radius: ${p => p.theme.radius.sm};
    pointer-events: none;

    background: ${p => p.theme.colors.dynamic.surface200};
    border-top: 3px solid ${p => p.theme.colors.dynamic.surface100};
    border-right: 1px solid ${p => p.theme.colors.dynamic.surface100};
    border-bottom: 1px solid ${p => p.theme.colors.dynamic.surface100};
    border-left: 1px solid ${p => p.theme.colors.dynamic.surface100};
    transition: all 100ms ease-in-out;

    > div {
      border-radius: ${p => p.theme.radius.sm};
      background: ${p => p.theme.colors.dynamic.surface500};
      border: 1px solid ${p => p.theme.colors.dynamic.surface100};

      width: ${p => ToggleButtonSize[p.nativeSize].width}px;
      height: ${p => ToggleButtonSize[p.nativeSize].height}px;
      position: absolute;
      top: 0;
      left: 0;
      transform: translateY(-1px);
      transition: all 100ms ease-in-out, transform 400ms linear(0, 0.877 9.4%, 1.08 14.6%, 0.993 30.8%, 1);

      &:after {
        /** The icon is not clickable */
        pointer-events: none;
        position: absolute;
        content: '';
        display: block;
        width: ${p => ToggleButtonSize[p.nativeSize].icon}px;
        height: ${p => ToggleButtonSize[p.nativeSize].icon}px;
        top: ${p => ToggleButtonSize[p.nativeSize].iconOffset}px;
        left: ${p => ToggleButtonSize[p.nativeSize].iconOffset}px;
        background-repeat: no-repeat;
        background-size: ${p => ToggleButtonSize[p.nativeSize].icon}px ${p => ToggleButtonSize[p.nativeSize].icon}px;
        transition: transform 500ms linear(0, 0.877 9.4%, 1.08 14.6%, 0.993 30.8%, 1);
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"><path fill="${p => urlEscapeHex(p.theme.colors.content.secondary)}" d="M5.03 3.97a.75.75 0 0 0-1.06 1.06L6.94 8l-2.97 2.97a.75.75 0 1 0 1.06 1.06L8 9.06l2.97 2.97a.75.75 0 1 0 1.06-1.06L9.06 8l2.97-2.97a.75.75 0 0 0-1.06-1.06L8 6.94 5.03 3.97Z" clip-rule="evenodd"/></svg>');
      }
    }
  }

  &:checked + div {
    background: ${p => p.theme.colors.static.blue400};
    border-top: 3px solid ${p => p.theme.colors.dynamic.blue100};
    border-right: 1px solid ${p => p.theme.colors.dynamic.blue100};
    border-bottom: 1px solid ${p => p.theme.colors.dynamic.blue100};
    border-left: 1px solid ${p => p.theme.colors.dynamic.blue100};

    > div {
      background: ${p => p.theme.colors.dynamic.surface500};
      border: 1px solid ${p => p.theme.colors.dynamic.blue100};
      transform: translateY(-1px) translateX(${p => ToggleWrapperSize[p.nativeSize].width - ToggleButtonSize[p.nativeSize].width}px);

      &:after {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"><path fill="${p => urlEscapeHex(p.theme.colors.content.accent)}" fill-rule="evenodd" d="M13.53 4.22c.3.3.3.77 0 1.06l-6.5 6.5a.75.75 0 0 1-1.08-.02l-3.5-3.75A.75.75 0 0 1 3.55 7l2.97 3.18 5.95-5.95c.3-.3.77-.3 1.06 0Z" clip-rule="evenodd"/></svg>');
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
  }
  &:checked:disabled + div > div {
    transform: translateY(0px) translateX(16px);
  }
`;

export const ChonkFakeCheckbox = chonkStyled('div')<{
  size: NonNullable<SwitchProps['size']>;
}>`
  width: ${p => ToggleWrapperSize[p.size].width}px;
  height: ${p => ToggleWrapperSize[p.size].height}px;
`;
export const ChonkFakeCheckboxButton = chonkStyled('div')`
`;
