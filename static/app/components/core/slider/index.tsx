import {forwardRef} from 'react';
import type {DO_NOT_USE_ChonkTheme, Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Slider = forwardRef<HTMLInputElement, SliderProps>((props, ref) => {
  return <StyledSlider ref={ref} type="range" {...props} />;
});

const StyledSlider = styled('input')<React.InputHTMLAttributes<HTMLInputElement>>`
  ${p => (p.theme.isChonk ? ChonkSliderStyles(p as any) : SliderStyles(p))}
`;

function SliderStyles(p: {theme: Theme}) {
  return css`
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    background: transparent;

    &::-webkit-slider-runnable-track {
      width: 100%;
      height: 3px;
      cursor: pointer;
      background: ${p.theme.border};
      border-radius: 3px;
      border: 0;
    }

    &::-moz-range-track {
      width: 100%;
      height: 3px;
      cursor: pointer;
      background: ${p.theme.border};
      border-radius: 3px;
      border: 0;
    }

    &::-webkit-slider-thumb {
      box-shadow: 0 0 0 3px ${p.theme.background};
      height: 17px;
      width: 17px;
      border-radius: 50%;
      background: ${p.theme.active};
      cursor: pointer;
      /* stylelint-disable-next-line property-no-vendor-prefix */
      -webkit-appearance: none;
      appearance: none;
      margin-top: -7px;
      border: 0;
      transition:
        background 0.1s,
        box-shadow 0.1s;
    }

    &::-moz-range-thumb {
      box-shadow: 0 0 0 3px ${p.theme.background};
      height: 17px;
      width: 17px;
      border-radius: 50%;
      background: ${p.theme.active};
      cursor: pointer;
      /* stylelint-disable-next-line property-no-vendor-prefix */
      -webkit-appearance: none;
      appearance: none;
      margin-top: -7px;
      border: 0;
      transition:
        background 0.1s,
        box-shadow 0.1s;
    }
    &:focus {
      outline: none;

      &::-webkit-slider-runnable-track {
        background: ${p.theme.border};
      }
    }

    &[disabled] {
      &::-webkit-slider-thumb {
        background: ${p.theme.border};
        cursor: default;
      }
      &::-moz-range-thumb {
        background: ${p.theme.border};
        cursor: default;
      }

      &::-webkit-slider-runnable-track {
        cursor: default;
      }
      &::-moz-range-track {
        cursor: default;
      }
    }

    &:not([disabled])::-webkit-slider-runnable-track:hover {
      background: ${p.theme.activeHover};
    }
    &:not([disabled])::-moz-range-track:hover {
      background: ${p.theme.activeHover};
    }

    &:focus::-webkit-slider-thumb {
      box-shadow:
        ${p.theme.background} 0 0 0 3px,
        ${p.theme.focus} 0 0 0 6px;
    }
    &:focus-visible::-webkit-slider-thumb {
      box-shadow:
        ${p.theme.background} 0 0 0 3px,
        ${p.theme.focus} 0 0 0 6px;
    }
    &:focus::-moz-range-thumb {
      box-shadow:
        ${p.theme.background} 0 0 0 3px,
        ${p.theme.focus} 0 0 0 6px;
    }
    &:focus-visible::-moz-range-thumb {
      box-shadow:
        ${p.theme.background} 0 0 0 3px,
        ${p.theme.focus} 0 0 0 6px;
    }
  `;
}

function ChonkSliderStyles(p: {theme: DO_NOT_USE_ChonkTheme}) {
  return css`
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    background: transparent;
    border-radius: ${p.theme.radius.lg};
    transition: box-shadow 0.1s;
    box-shadow:
      0 0 0 8px transparent,
      0 0 0 10px transparent;

    &:focus {
      outline: none;
      box-shadow:
        0 0 0 8px ${p.theme.background},
        0 0 0 10px ${p.theme.focusBorder};
    }

    &[disabled] {
      cursor: not-allowed;
      opacity: 0.6;

      &::-webkit-slider-runnable-track {
        cursor: not-allowed;
      }

      &::-webkit-slider-thumb {
        cursor: not-allowed;
      }
    }

    /* Chrome styling */
    &::-webkit-slider-runnable-track {
      width: 100%;
      height: 12px;
      cursor: pointer;
      border: 1px solid ${p.theme.colors.chonk.blue100};
      background: ${p.theme.colors.surface300};
      border-radius: ${p.theme.radius.micro};
      box-shadow: 0px 3px 0px 0px ${p.theme.colors.surface100} inset;
    }

    &::-webkit-slider-thumb {
      appearance: none;
      width: 24px;
      height: 24px;
      background: ${p.theme.colors.surface300};
      border: 1px solid ${p.theme.colors.chonk.blue100};
      border-bottom: 2px solid ${p.theme.colors.chonk.blue100};
      border-radius: ${p.theme.radius.lg};
      transform: translateY(-7px);
    }

    /* Firefox styling */
    &::-moz-range-track {
      width: 100%;
      height: 12px;
      cursor: pointer;
      border: 1px solid ${p.theme.colors.surface100};
      background: ${p.theme.colors.surface300};
      border-radius: ${p.theme.radius.micro};
      box-shadow: 0px 3px 0px 0px ${p.theme.colors.surface100} inset;
    }

    &::-moz-range-thumb {
      appearance: none;
      width: 24px;
      height: 24px;
      background: ${p.theme.colors.surface300};
      border: 1px solid ${p.theme.colors.chonk.blue100};
      border-bottom: 2px solid ${p.theme.colors.chonk.blue100};
      border-radius: ${p.theme.radius.lg};
      transform: translateY(0);
    }
  `;
}
