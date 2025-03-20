import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';

import type {SliderProps} from './index';

const passthrough = (n: number | '') => n;

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({formatLabel = passthrough, ...props}, ref) => {
    const inputRef = useRef<HTMLInputElement>();
    const refs = mergeRefs([ref, inputRef]);
    const [label, setLabel] = useState((props.value ?? props.defaultValue) || 50);
    const initialProgress = getProgress(
      (props.value ?? props.defaultValue) || 50,
      props.min ?? 0,
      props.max ?? 100
    );

    const handleChange = useCallback(
      (event: Event) => {
        const input = event.target as HTMLInputElement;
        const {valueAsNumber, min, max} = input;
        setLabel(valueAsNumber);
        const progress = getProgress(valueAsNumber, min || 0, max || 100);
        input.parentElement?.style.setProperty('--p', `${progress.toFixed(0)}%`);
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
      <SliderContainer style={{'--p': `${initialProgress.toFixed(0)}%`} as CSSProperties}>
        {props.disabled ? null : (
          <SliderOutput htmlFor={props.id}>
            <SliderLabel>{formatLabel(label)}</SliderLabel>
          </SliderOutput>
        )}
        {props.step ? <SliderTicks n={props.step} /> : null}
        <StyledSlider ref={refs} type="range" {...props} />
      </SliderContainer>
    );
  }
);

function SliderTicks({n}: {n: number}) {
  return (
    <StepsContainer role="presentation">
      {Array.from({length: n}, (_, i) => (
        <StepMark key={i} />
      ))}
    </StepsContainer>
  );
}

const StepsContainer = styled('div')`
  pointer-events: none;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: row;
  height: 12px;
  width: calc(100% - 24px);
  margin-inline: auto;
  z-index: 1;
`;

const StepMark = styled('span')<{theme?: DO_NOT_USE_ChonkTheme}>`
  box-sizing: border-box;
  position: relative;
  flex-grow: 1;
  height: 100%;

  &::before {
    content: '';
    position: absolute;
    height: 12px;
    width: 2px;
    background: linear-gradient(90deg, white, black);
    opacity: 0.5;
    mix-blend-mode: multiply;
  }
`;

function toNumber(value: number | string) {
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
}
function getProgress(n: number, min: number | string, max: number | string) {
  return ((n - toNumber(min)) / toNumber(max)) * 100;
}

const StyledSlider = styled('input')`
  ${p => chonkSliderStyles(p as any)}
`;
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

    &:focus-visible {
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
      min-width: calc(${p.theme.radius.micro} * 6);
      width: var(--p, 50%);
      height: 12px;
      background: var(--track-active-color);
      box-shadow: 0px 3px 0px 0px var(--track-active-color-dark) inset;
      border: 1px solid var(--track-active-color-dark);
      border-radius: ${p.theme.radius.micro};
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

const SliderOutput = styled('output')`
  ${p => chonkOutput(p as any)}
`;
export function chonkOutput(p: {theme: DO_NOT_USE_ChonkTheme}) {
  return css`
    --tx: clamp(-50%, calc(-50% + var(--p, 0)), 50%);
    --ty: var(--label-ty);
    --o: var(--label-opacity);

    /* disable interactions */
    pointer-events: none;
    user-select: none;

    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${p.theme.fontSizeSmall};
    position: absolute;
    height: 24px;
    width: calc(100% - 24px);
    margin-inline: auto;
    left: 0;
    right: 0;
    bottom: 24px;
    text-align: center;

    opacity: var(--o);
    transform: translate(var(--tx), var(--ty));
    transition:
      100ms opacity cubic-bezier(0.23, 1, 0.32, 1),
      100ms transform cubic-bezier(0.39, 0.575, 0.565, 1);
  `;
}
const SliderLabel = styled('span')<{theme?: DO_NOT_USE_ChonkTheme}>`
  font-size: inherit;
  display: block;
  min-width: calc(3ch + ${space(0.5)});
  padding-inline: ${space(0.5)};
  width: min-content;
  text-align: center;
  background: ${p => p.theme.colors.black};
  color: ${p => p.theme.white};
  border-radius: ${p => p.theme.radius.micro};
`;

const SliderContainer = styled('div')`
  position: relative;
  width: 100%;
  flex-grow: 1;
  --label-opacity: 0;
  --label-ty: 100%;

  &:focus-within,
  &:hover,
  &:active {
    --label-opacity: 1;
    --label-ty: 0;
  }
`;
