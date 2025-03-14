import {forwardRef, useCallback, useEffect, useRef, useState} from 'react';
import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import mergeRefs from 'sentry/utils/mergeRefs';

import type {SliderProps} from './index';

export const Slider = forwardRef<HTMLInputElement, SliderProps>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>();
  const refs = mergeRefs([ref, inputRef]);
  const [label, setLabel] = useState(props.value ?? '50');

  const handleChange = useCallback(
    (event: Event) => {
      const input = event.target as HTMLInputElement;
      const {value, valueAsNumber, min, max} = input;
      setLabel(value);
      const progress =
        ((valueAsNumber - Number(min || '0')) / Number(max || '100')) * 100;
      input.parentElement?.style.setProperty('--p', `${progress.toFixed(2)}`);
      input.style.setProperty('--p', `${progress.toFixed(2)}%`);
    },
    [setLabel]
  );

  useEffect(() => {
    const input: HTMLInputElement | undefined = inputRef.current;
    if (!input) {
      return;
    }
    input.addEventListener('input', handleChange);
    // eslint-disable-next-line consistent-return
    return () => input.removeEventListener('input', handleChange);
  });

  return (
    <SliderContainer>
      <SliderLabel>
        <SliderLabelInner>{label}</SliderLabelInner>
      </SliderLabel>
      <StyledSlider ref={refs} type="range" {...props} />
    </SliderContainer>
  );
});

const StyledSlider = styled('input')`
  ${p => chonkSliderStyles(p as any)}
`;
const SliderLabel = styled('span')`
  ${p => chonkLabel(p as any)}
`;
const SliderLabelInner = styled('span')`
  ${p => chonkLabelInner(p as any)}
`;
const SliderContainer = styled('span')`
  position: relative;
`;

export function chonkLabel(p: {theme: DO_NOT_USE_ChonkTheme}) {
  return css`
    display: flex;
    color: ${p.theme.colors.chonk.blue400};
    font-size: ${p.theme.fontSizeMedium};
    position: absolute;
    height: 24px;
    bottom: 12px;
    padding-left: calc(var(--p) * 1%);
  `;
}
export function chonkLabelInner(_p: {theme: DO_NOT_USE_ChonkTheme}) {
  return css`
    display: block;
    width: 48px;
    text-align: center;
  `;
}
export function chonkSliderStyles(p: {theme: DO_NOT_USE_ChonkTheme}) {
  return css`
    --track-color: ${p.theme.colors.surface300};
    --track-color-dark: ${p.theme.colors.surface100};
    --track-active-color: ${p.theme.colors.chonk.blue400};
    --track-active-color-dark: ${p.theme.colors.chonk.blue100};
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    appearance: none;
    position: relative;
    width: 100%;
    height: 12px;
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

    &::before {
      content: '';
      position: absolute;
      width: var(--p, 50%);
      height: 12px;
      background: var(--track-active-color);
      box-shadow: 0px 3px 0px 0px var(--track-active-color-dark) inset;
      border: 1px solid var(--track-active-color-dark);
      border-radius: ${p.theme.radius.micro} 0 0 ${p.theme.radius.micro};
    }

    /* Chrome styling */
    &::-webkit-slider-runnable-track {
      width: 100%;
      height: 12px;
      background: var(--track-color);
      box-shadow: 0px 3px 0px 0px var(--track-color-dark) inset;
      border: 1px solid var(--track-color-dark);
      border-radius: ${p.theme.radius.micro};
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
      z-index: 1;
    }

    /* Firefox styling */
    &::-moz-range-track {
      width: 100%;
      height: 12px;
      background: var(--track-color);
      box-shadow: 0px 3px 0px 0px var(--track-color-dark) inset;
      border: 1px solid var(--track-color-dark);
      border-radius: ${p.theme.radius.micro};
    }

    &::-moz-range-thumb {
      appearance: none;
      width: 24px;
      height: 24px;
      background: ${p.theme.colors.surface300};
      border: 1px solid ${p.theme.colors.chonk.blue100};
      border-bottom: 2px solid ${p.theme.colors.chonk.blue100};
      border-radius: ${p.theme.radius.lg};
      transform: translateY(-7px);
      z-index: 1;
    }
  `;
}
