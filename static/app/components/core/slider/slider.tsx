import {useState, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import {chonkFor} from 'sentry/components/core/chonk';
import {space} from 'sentry/styles/space';

interface BaseProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange' | 'defaultValue'
  > {
  defaultValue?: number;
  /** Optional callback to format the label */
  formatLabel?: (value: number | '') => React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

interface ControlledProps extends BaseProps {
  onChange: (value: number, event: React.ChangeEvent<HTMLInputElement>) => void;
  value: number | '';
}

interface UncontrolledProps extends BaseProps {
  defaultValue?: number;
  onChange?: never;
  value?: never;
}

type SliderProps = ControlledProps | UncontrolledProps;

export function Slider({formatLabel = passthrough, ref, ...props}: SliderProps) {
  const step = toNumber(props.step ?? -1);
  const {value: resolvedValue, min, max} = resolveMinMaxValue(props);
  const [valueAsNumber, setValueAsNumber] = useState(resolvedValue);

  const value = props.onChange ? resolvedValue : valueAsNumber;

  const progress = getProgress(value, min, max);
  const numSteps = Math.abs(max - min) / step;
  const formattedLabel = formatLabel(value);

  return (
    <SliderContainer
      aria-disabled={props.disabled}
      style={{'--p': `${progress.toFixed(0)}%`, '--steps': `${value}`} as CSSProperties}
    >
      {props.step ? <SliderTicks progress={progress} numSteps={numSteps} /> : null}
      <StyledSlider
        ref={ref}
        type="range"
        {...props}
        onChange={e => {
          const newValue = e.currentTarget.valueAsNumber;
          setValueAsNumber(newValue);
          props.onChange?.(newValue, e);
        }}
      />
      {props.disabled ||
      formattedLabel === null ||
      formattedLabel === undefined ? null : (
        <SliderOutput htmlFor={props.id}>
          <SliderLabel>{formattedLabel}</SliderLabel>
        </SliderOutput>
      )}
    </SliderContainer>
  );
}

function SliderTicks({progress, numSteps}: {numSteps: number; progress: number}) {
  const filledSteps = Math.floor((numSteps * progress) / 100);
  return (
    <StepsContainer role="presentation">
      {Array.from({length: numSteps}, (_, i) => {
        return <StepMark key={i} filled={i <= filledSteps} />;
      })}
    </StepsContainer>
  );
}

const passthrough = (n: number | '') => n;

const StepsContainer = styled('div')`
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
    border-radius: ${p => p.theme.radius.lg};
    background: ${p => p.theme.colors.surface100};
  }
`;

const StepMark = styled('span')<{filled?: boolean}>`
  box-sizing: border-box;
  position: relative;
  flex-grow: 1;
  height: 100%;

  &::before {
    content: '';
    position: absolute;
    height: 12px;
    width: 2px;
    border-radius: ${p => p.theme.radius.lg};
    background: ${p =>
      p.filled ? p.theme.colors.chonk.blue400 : p.theme.colors.surface100};
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
  return (Math.abs(n - toNumber(min)) / Math.abs(toNumber(max) - toNumber(min))) * 100;
}
function resolveMinMaxValue(props: SliderProps) {
  const min = toNumber(props.min ?? 0);
  const max = toNumber(props.max ?? 100);
  const mid = min + Math.abs(max - min) / 2;
  const _value = props.value ?? props.defaultValue ?? mid;
  const value = _value === '' ? mid : _value;
  return {value, min, max};
}

const StyledSlider = styled('input')`
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  width: 100%;
  height: 16px;
  background: transparent;
  border-radius: ${p => p.theme.radius['2xs']};
  transition: box-shadow ${p => p.theme.motion.smooth.fast};
  box-shadow:
    0 0 0 8px transparent,
    0 0 0 10px transparent;

  &:focus-visible {
    ${p => p.theme.focusRing()};
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
    min-width: calc(${p => p.theme.radius['2xs']} * 6);
    width: var(--p, 50%);
    height: 4px;
    background: ${p => p.theme.colors.chonk.blue400};
    border: 1px solid ${p => p.theme.colors.chonk.blue400};
    border-radius: ${p => p.theme.radius['2xs']};
  }

  /* Chrome styling */
  &::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    background: ${p => p.theme.colors.surface100};
    border: 1px solid ${p => p.theme.colors.surface100};
    border-radius: ${p => p.theme.radius['2xs']};
  }

  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: ${p => p.theme.colors.white};
    border: 1px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
    border-bottom: 2px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
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
    border-radius: ${p => p.theme.radius['2xs']};
  }

  &::-moz-range-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: ${p => p.theme.colors.white};
    border: 1px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
    border-bottom: 2px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
    border-radius: ${p => p.theme.radius.sm};
    transform: translateY(-7px);
    z-index: 1;
  }
`;

const SliderOutput = styled('output')`
  --tx: clamp(-50%, calc(-50% + var(--p, 0)), 50%);
  --ty: var(--label-ty);
  --o: var(--label-opacity);

  /* disable interactions */
  pointer-events: none;
  user-select: none;

  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${p => p.theme.font.size.sm};
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
    opacity ${p => p.theme.motion.exit.fast},
    transform ${p => p.theme.motion.smooth.fast};
`;

const SliderLabel = styled('span')`
  font-size: inherit;
  display: block;
  min-width: calc(3ch + ${space(0.5)});
  padding-inline: ${space(0.5)};
  width: min-content;
  text-align: center;
  background: ${p => p.theme.colors.chonk.blue400};
  border: 1px solid ${p => chonkFor(p.theme, p.theme.colors.chonk.blue400)};
  color: ${p => p.theme.white};
  border-radius: ${p => p.theme.radius['2xs']};
  z-index: ${p => p.theme.zIndex.tooltip};
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

  &[aria-disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
