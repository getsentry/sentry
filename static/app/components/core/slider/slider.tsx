import {useCallback, useImperativeHandle, useMemo, useRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useNumberFormatter} from '@react-aria/i18n';
import type {AriaSliderProps} from '@react-aria/slider';
import {useSlider, useSliderThumb} from '@react-aria/slider';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {useSliderState} from '@react-stately/slider';

interface BaseProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange' | 'id'
> {
  defaultValue?: number;
  disabled?: boolean;
  /** @deprecated Use `formatOptions` (Intl.NumberFormatOptions) instead. */
  formatLabel?: (value: number | '') => React.ReactNode;
  /** Intl.NumberFormat options for automatic numeric formatting */
  formatOptions?: Intl.NumberFormatOptions;
  /** ID applied to the hidden input element (enables label `htmlFor` linking) */
  id?: string;
  max?: number;
  min?: number;
  /** Name for the hidden input element (for form submissions) */
  name?: string;
  /** Called when the user finishes adjusting the slider (on mouse/pointer/touch release or keyboard commit). */
  onChangeEnd?: (value: number) => void;
  ref?: React.Ref<HTMLInputElement>;
  step?: number;
  /** Tick mark configuration. Use `count` for evenly spaced ticks, `interval` for fixed spacing, or `values` for explicit positions. Set `labels` to show value labels below ticks. */
  ticks?:
    | {count: number; labels?: boolean}
    | {interval: number; labels?: boolean}
    | {values: number[]; labels?: boolean};
}

interface ControlledProps extends BaseProps {
  onChange: (value: number) => void;
  /** Accepts `''` for backwards compatibility with legacy form fields. */
  value: number | '';
}

interface UncontrolledProps extends BaseProps {
  defaultValue?: number;
  onChange?: never;
  value?: never;
}

export type SliderProps = ControlledProps | UncontrolledProps;

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  ticks,
  formatLabel,
  formatOptions,
  name,
  id,
  onChangeEnd,
  className,
  ref,
  ...props
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    value,
    onChange,
    defaultValue,
    'aria-valuetext': ariaValueText,
    ...restProps
  } = props;
  const effectiveValue = value === '' ? undefined : value;

  const htmlProps = restProps;

  const numberFormatter = useNumberFormatter(formatOptions ?? {});

  const ariaProps: AriaSliderProps = {
    minValue: min,
    maxValue: max,
    step,
    isDisabled: disabled,
    'aria-label': htmlProps['aria-label'],
    'aria-labelledby': htmlProps['aria-labelledby'],
    ...(effectiveValue !== undefined && {value: [effectiveValue]}),
    ...(defaultValue !== undefined &&
      effectiveValue === undefined && {defaultValue: [defaultValue]}),
    onChange: (values: number | number[]) =>
      onChange?.(Array.isArray(values) ? (values[0] ?? min) : values),
    onChangeEnd: onChangeEnd
      ? (values: number | number[]) =>
          onChangeEnd(Array.isArray(values) ? (values[0] ?? min) : values)
      : undefined,
  };

  const state = useSliderState({...ariaProps, numberFormatter});
  const {groupProps, trackProps} = useSlider(ariaProps, state, trackRef);
  const {thumbProps, inputProps} = useSliderThumb(
    {index: 0, trackRef, inputRef, isDisabled: disabled},
    state
  );

  useImperativeHandle(ref, () => inputRef.current!, []);

  const thumbPercent = state.getThumbPercent(0);
  const thumbValue = state.values[0] ?? min;

  const allTickValues = useMemo<number[]>(() => {
    if (!ticks) {
      return [];
    }

    if ('values' in ticks) {
      return ticks.values;
    }

    if ('interval' in ticks) {
      const count = Math.floor((max - min) / ticks.interval) + 1;
      return Array.from({length: count}, (_, i) => min + i * ticks.interval);
    }

    if (ticks.count >= 2) {
      const range = max - min;
      return Array.from(
        {length: ticks.count},
        (_, i) => min + i * (range / (ticks.count - 1))
      );
    }

    return [];
  }, [ticks, min, max]);

  const intermediateTickValues = useMemo<number[]>(() => {
    return allTickValues.filter(tickValue => tickValue !== min && tickValue !== max);
  }, [allTickValues, min, max]);

  const getFormattedValue = useCallback(
    (val: number | '') => {
      if (val === '') {
        return formatLabel ? formatLabel('') : '';
      }
      return formatLabel ? formatLabel(val) : state.getFormattedValue(val);
    },
    [formatLabel, state]
  );

  const hasTicks = allTickValues.length > 0;
  const tickAnimationDuration = hasTicks ? 160 : 60;
  const tickDelay = hasTicks ? tickAnimationDuration / intermediateTickValues.length : 0;

  return (
    <SliderWrapper
      {...groupProps}
      {...htmlProps}
      className={className}
      aria-disabled={disabled || undefined}
    >
      <TrackArea ref={trackRef} {...trackProps} disabled={disabled}>
        <SliderTrackBar>
          <ActiveTrack style={{width: `${thumbPercent * 100}%`}} />
          <InactiveTrack style={{width: `${(1 - thumbPercent) * 100}%`}} />

          {intermediateTickValues.map(tickValue => (
            <SliderTick
              key={tickValue}
              aria-hidden
              data-filled={tickValue <= thumbValue || undefined}
              style={{
                left: `${(state.getValuePercent(tickValue) * 100).toFixed(2)}%`,
              }}
            />
          ))}
        </SliderTrackBar>

        <SliderThumbHitbox {...thumbProps} style={{left: `${thumbPercent * 100}%`}}>
          <SliderThumbChonk>
            <SliderThumbSurface />
          </SliderThumbChonk>
          <VisuallyHidden>
            <input
              ref={inputRef}
              {...inputProps}
              name={name}
              id={id ?? inputProps.id}
              aria-invalid={htmlProps['aria-invalid'] as boolean | undefined}
              {...(ariaValueText !== undefined && {'aria-valuetext': ariaValueText})}
            />
          </VisuallyHidden>
        </SliderThumbHitbox>

        <ValueLabel
          aria-hidden
          style={
            {
              '--thumb-value': `${thumbPercent * 100}%`,
              '--thumb-offset': `${(2 * thumbPercent - 1) * 12}px`,
            } as React.CSSProperties
          }
        >
          {getFormattedValue(thumbValue)}
        </ValueLabel>
      </TrackArea>

      <TrackLabels aria-hidden>
        <TrackLabel data-position="start" style={{transitionDelay: '0ms'}}>
          {getFormattedValue(min)}
        </TrackLabel>
        {hasTicks &&
          intermediateTickValues.map((tickValue, index) => (
            <TrackLabel
              key={tickValue}
              data-intermediate
              data-show={ticks?.labels || undefined}
              style={{
                transitionDelay: `${((index + 1) * tickDelay).toFixed(2)}ms`,
                left: `${(state.getValuePercent(tickValue) * 100).toFixed(2)}%`,
              }}
            >
              {getFormattedValue(tickValue)}
            </TrackLabel>
          ))}
        <TrackLabel
          data-position="end"
          style={{transitionDelay: `${tickAnimationDuration}ms`}}
        >
          {getFormattedValue(max)}
        </TrackLabel>
      </TrackLabels>
    </SliderWrapper>
  );
}

const SliderWrapper = styled('div')`
  isolation: isolate;
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  white-space: nowrap;
  user-select: none;
  height: 64px;
`;

const TrackArea = styled('div', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'disabled',
})<{disabled: boolean}>`
  position: relative;
  width: 100%;
  padding-top: 20px;
  padding-bottom: 6px;
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};

  ${SliderWrapper}:is([aria-disabled]) & {
    pointer-events: none;
    opacity: ${p => p.theme.tokens.interactive.disabled};
  }
`;

const SliderTrackBar = styled('div')`
  position: relative;
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  pointer-events: none;
`;

const trackBarBase = css`
  height: 12px;
  pointer-events: none;
`;

const ActiveTrack = styled('div')`
  ${trackBarBase}
  border-top-left-radius: ${p => p.theme.radius.lg};
  border-bottom-left-radius: ${p => p.theme.radius.lg};
  background: ${p => p.theme.tokens.interactive.chonky.debossed.accent.background};
  border-style: solid;
  border-color: ${p => p.theme.tokens.interactive.chonky.debossed.accent.chonk};
  border-width: 2px 0 1px 1px;
`;

const InactiveTrack = styled('div')`
  ${trackBarBase}
  flex: 1;
  border-top-right-radius: ${p => p.theme.radius.lg};
  border-bottom-right-radius: ${p => p.theme.radius.lg};
  background: ${p => p.theme.tokens.interactive.chonky.debossed.neutral.background};
  border-style: solid;
  border-color: ${p => p.theme.tokens.interactive.chonky.debossed.neutral.chonk};
  border-width: 2px 1px 1px 0;
`;

const SliderThumbHitbox = styled('div')`
  position: absolute;
  /* 20px padding-top + 12px (half of 24px track row) = 32px to track center */
  top: 32px;
  width: 24px;
  height: 24px;
  transform: translate(-50%, -50%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SliderThumbChonk = styled('div')`
  width: 22px;
  height: 23px;
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  display: flex;
  align-items: flex-start;
  justify-content: center;
  pointer-events: none;
  flex-shrink: 0;
  transition:
    background 120ms ease,
    box-shadow 120ms ease;

  ${SliderWrapper}:not([aria-disabled]):is(:hover, :active, :focus-within) & {
    background: ${p => p.theme.tokens.interactive.chonky.embossed.accent.chonk};
  }
`;

const SliderThumbSurface = styled('div')`
  margin-top: 1px;
  width: 20px;
  height: 20px;
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.background.overlay};
  pointer-events: none;
`;

const SliderTick = styled('div')`
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 1px;
  height: 12px;
  border: 1px solid ${p => p.theme.tokens.interactive.chonky.debossed.neutral.chonk};
  pointer-events: none;

  &[data-filled] {
    border-color: ${p => p.theme.tokens.interactive.chonky.debossed.accent.chonk};
  }
`;

const TrackLabels = styled('div')`
  display: flex;
  position: relative;
  width: 100%;
  height: 20px;
  pointer-events: none;
  justify-content: space-between;
  align-items: center;
  --tx: 0;
  --ty: -${p => p.theme.space.xs};

  ${SliderWrapper}:not([aria-disabled]):is(:hover, :focus-within) & {
    --ty: 0;
    --opacity: 1;
  }
`;

const TrackLabel = styled('span')`
  display: block;
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.tokens.content.secondary};
  opacity: var(--opacity, 0);
  white-space: nowrap;
  transform: translate(var(--tx, 0), var(--ty, 0));
  transition:
    transform ${p => p.theme.motion.enter.fast},
    opacity ${p => p.theme.motion.enter.fast};

  &[data-intermediate] {
    --tx: -50%;
    position: absolute;
  }

  &[data-intermediate]:not([data-show]) {
    --opacity: 0;
  }

  ${SliderWrapper}[aria-disabled] & {
    color: ${p => p.theme.tokens.content.disabled};
  }
`;

const ValueLabel = styled('output')`
  position: absolute;
  top: 0;
  left: var(--thumb-value, 50%);
  transform: translateX(calc(-1 * var(--thumb-value, 50%) + var(--thumb-offset, 0px)))
    translateY(var(--thumb-y, 0px));
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  color: ${p => p.theme.tokens.content.secondary};
  transition:
    background ${p => p.theme.motion.snap.moderate},
    color ${p => p.theme.motion.snap.moderate},
    padding ${p => p.theme.motion.snap.moderate},
    border-color ${p => p.theme.motion.snap.moderate};
  min-width: 24px;
  border: 1px solid transparent;
  border-radius: ${p => p.theme.radius.xs};
  padding: 1px ${p => p.theme.space['2xs']};
  text-align: center;
  line-height: 1;

  &::after {
    content: '';
    position: absolute;
    inset: -4px;
    bottom: -32px;
    border-radius: ${p => p.theme.radius.md};
  }

  ${SliderWrapper}:has(:focus-visible) &::after {
    ${p => p.theme.focusRing()};
  }

  ${SliderWrapper}:hover:not(:active, :focus-within) & {
    color: ${p => p.theme.tokens.content.accent};
  }

  ${SliderWrapper}:not([aria-disabled]):is(:active, :focus-within) & {
    background: ${p => p.theme.tokens.background.accent.vibrant};
    border-color: ${p => p.theme.tokens.interactive.chonky.embossed.accent.chonk};
    color: ${p => p.theme.tokens.content.onVibrant.light};
    --thumb-y: 0;
  }

  ${SliderWrapper}[aria-disabled] & {
    background: transparent;
    border-color: transparent;
    color: ${p => p.theme.tokens.content.disabled};
    --thumb-y: 0;
  }
`;
