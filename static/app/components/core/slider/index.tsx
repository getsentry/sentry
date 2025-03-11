import {forwardRef} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Slider = forwardRef<HTMLInputElement, SliderProps>((props, ref) => {
  return <StyledSlider ref={ref} type="range" {...props} />;
});

const StyledSlider = styled(Slider)<React.InputHTMLAttributes<HTMLInputElement>>`
  ${p => SliderStyles(p)}
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
