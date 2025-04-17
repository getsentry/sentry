import {type CSSProperties, useState} from 'react';

import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

import type {SliderProps} from './index';

const passthrough = (n: number | '') => n;

export function Slider({
  formatLabel = passthrough,
  ref,
  ...props
}: SliderProps & {ref?: React.Ref<HTMLInputElement>}) {
  const step = toNumber(props.step ?? -1);
  const {value, min, max} = resolveMinMaxValue(props);
  const [valueAsNumber, setValueAsNumber] = useState(value);

  const filledSteps = step === -1 ? -1 : valueAsNumber / step;
  const progress = getProgress(valueAsNumber, min, max);

  return (
    <SliderContainer
      aria-disabled={props.disabled}
      style={
        {'--p': `${progress.toFixed(0)}%`, '--steps': `${valueAsNumber}`} as CSSProperties
      }
    >
      {props.step ? (
        <SliderTicks
          filledSteps={filledSteps}
          n={
            typeof props.step === 'string' ? Number.parseInt(props.step, 10) : props.step
          }
        />
      ) : null}
      <StyledSlider
        ref={ref}
        type="range"
        {...props}
        onChange={e => setValueAsNumber(e.currentTarget.valueAsNumber)}
      />
      {props.disabled ? null : (
        <SliderOutput htmlFor={props.id}>
          <SliderLabel>{formatLabel(valueAsNumber)}</SliderLabel>
        </SliderOutput>
      )}
    </SliderContainer>
  );
}

function SliderTicks({n, filledSteps}: {filledSteps: number; n: number}) {
  return (
    <StepsContainer role="presentation">
      {Array.from({length: n}, (_, i) => {
        return <StepMark key={i} filled={i <= filledSteps} />;
      })}
    </StepsContainer>
  );
}

const StepsContainer = chonkStyled('div')`
  pointer-events: none;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: row;
  height: 14px;
  width: calc(100% - 16px);
  margin-inline: auto;

  &::before {
    content: '';
    position: absolute;
    right: 0;
    height: 12px;
    width: 2px;
    border-radius: ${p => p.theme.radius.xl};
    background: ${p => p.theme.colors.surface100};
  }
`;

const StepMark = chonkStyled('span')<{filled?: boolean}>`
  box-sizing: border-box;
  position: relative;
  flex-grow: 1;
  height: 100%;

  &::before {
    content: '';
    position: absolute;
    height: 12px;
    width: 2px;
    border-radius: ${p => p.theme.radius.xl};
    background: ${p =>
      p.filled ? p.theme.colors.chonk.blue300 : p.theme.colors.surface100};
  }
`;

function toNumber(value: number | string) {
  if (typeof value === 'number') {
    return value;
  }
  if (value === '') {
    return 0;
  }
  return Number.parseInt(value, 10);
}
function getProgress(n: number, min: number | string, max: number | string) {
  return ((n - toNumber(min)) / toNumber(max)) * 100;
}
function resolveMinMaxValue(props: SliderProps) {
  const min = toNumber(props.min ?? 0);
  const max = toNumber(props.min ?? 100);
  const _value = props.value ?? props.defaultValue;
  const value = _value === '' ? 50 : toNumber(_value ?? (max - min) / 2);
  return {value, min, max};
}

const StyledSlider = chonkStyled('input')`
    -webkit-appearance: none;
    appearance: none;
    position: relative;
    width: 100%;
    height: 16px;
    background: transparent;
    border-radius: ${p => p.theme.radius.nano};
    transition: box-shadow 0.1s;
    box-shadow:
      0 0 0 8px transparent,
      0 0 0 10px transparent;

    &:focus-visible {
      ${p => p.theme.focusRing};
    }

    &[disabled] {
      cursor: not-allowed;

      &::-webkit-slider-runnable-track {
        cursor: not-allowed;
      }

      &::-webkit-slider-thumb {
        cursor: not-allowed;
        border-bottom-width: 1px;
      }
    }

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      margin: auto 0;
      min-width: calc(${p => p.theme.radius.micro} * 6);
      width: var(--p, 50%);
      height: 4px;
      background: ${p => p.theme.colors.chonk.blue300};
      border: 1px solid ${p => p.theme.colors.chonk.blue300};
      border-radius: ${p => p.theme.radius.micro};
    }

    /* Chrome styling */
    &::-webkit-slider-runnable-track {
      width: 100%;
      height: 4px;
      background: ${p => p.theme.colors.surface100};
      border: 1px solid ${p => p.theme.colors.surface100};
      border-radius: ${p => p.theme.radius.micro};
    }

    &::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      background: ${p => p.theme.colors.white};
      border: 1px solid ${p => p.theme.colors.chonk.blue100};
      border-bottom: 2px solid ${p => p.theme.colors.chonk.blue100};
      border-radius: ${p => p.theme.radius.sm};
      transform: translateY(-7px);
      z-index: 10;
    }

    /* Firefox styling */
    &::-moz-range-track {
      width: 100%;
      height: 4px;
      background: ${p => p.theme.colors.surface100};
      border: 1px solid ${p => p.theme.colors.surface100};
      border-radius: ${p => p.theme.radius.micro};
    }

    &::-moz-range-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      background: ${p => p.theme.colors.white};
      border: 1px solid ${p => p.theme.colors.chonk.blue100};
      border-bottom: 2px solid ${p => p.theme.colors.chonk.blue100};
      border-radius: ${p => p.theme.radius.sm};
      transform: translateY(-7px);
      z-index: 1;
    }
`;

const SliderOutput = chonkStyled('output')`
  --tx: clamp(-50%, calc(-50% + var(--p, 0)), 50%);
    --ty: var(--label-ty);
    --o: var(--label-opacity);

    /* disable interactions */
    pointer-events: none;
    user-select: none;

    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${p => p.theme.fontSizeSmall};
    position: absolute;
    height: 24px;
    width: calc(100% - 16px);
    margin-inline: auto;
    left: 0;
    right: 0;
    bottom: 20px;
    text-align: center;

    opacity: var(--o);
    transform: translate(var(--tx), var(--ty));
    transition:
      100ms opacity cubic-bezier(0.23, 1, 0.32, 1),
      50ms transform cubic-bezier(0.39, 0.575, 0.565, 1);
`;

const SliderLabel = chonkStyled('span')`
  font-size: inherit;
  display: block;
  min-width: calc(3ch + ${space(0.5)});
  padding-inline: ${space(0.5)};
  width: min-content;
  text-align: center;
  background: ${p => p.theme.colors.chonk.blue300};
  border: 1px solid ${p => p.theme.colors.chonk.blue100};
  color: ${p => p.theme.white};
  border-radius: ${p => p.theme.radius.micro};
  z-index: ${p => p.theme.zIndex.tooltip};
`;

const SliderContainer = chonkStyled('div')`
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

  &[aria-disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
