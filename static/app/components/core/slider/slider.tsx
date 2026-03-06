import {useCallback, useImperativeHandle, useMemo, useRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useNumberFormatter} from '@react-aria/i18n';
import type {AriaSliderProps} from '@react-aria/slider';
import {useSlider, useSliderThumb} from '@react-aria/slider';
import {mergeRefs} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {useSliderState} from '@react-stately/slider';

import {Flex} from '@sentry/scraps/layout';

interface BaseProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  defaultValue?: number;
  disabled?: boolean;
  /** Custom formatting for the value label */
  formatLabel?: (value: number | '') => React.ReactNode;
  /** Intl.NumberFormat options for automatic numeric formatting */
  formatOptions?: Intl.NumberFormatOptions;
  max?: number;
  min?: number;
  /** Name for the hidden input element (for form submissions) */
  name?: string;
  ref?: React.Ref<HTMLInputElement>;
  /** Whether to show labels below track ticks */
  showTickLabels?: boolean;
  step?: number;
  /** Explicit array of values at which to render tick marks */
  tickValues?: number[];
  /** Number of tick marks (including min/max endpoints) */
  ticks?: number;
  /** Interval between tick marks */
  ticksInterval?: number;
}

interface ControlledProps extends BaseProps {
  onChange: (value: number) => void;
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
  ticksInterval,
  tickValues,
  showTickLabels = false,
  formatLabel,
  formatOptions,
  name,
  className,
  ref,
  ...props
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {value, onChange} = props as ControlledProps;
  const effectiveValue = value === '' ? undefined : value;

  const numberFormatter = useNumberFormatter(formatOptions ?? {});

  const ariaProps: AriaSliderProps = {
    minValue: min,
    maxValue: max,
    step,
    isDisabled: disabled,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    ...(effectiveValue !== undefined && {value: [effectiveValue]}),
    ...(props.defaultValue !== undefined &&
      effectiveValue === undefined && {defaultValue: [props.defaultValue]}),
    onChange: (values: number | number[]) =>
      onChange?.(Array.isArray(values) ? values[0]! : values),
  };

  const state = useSliderState({...ariaProps, numberFormatter});
  const {groupProps, trackProps} = useSlider(ariaProps, state, trackRef);
  const {thumbProps, inputProps, isFocused, isDragging} = useSliderThumb(
    {index: 0, trackRef, inputRef, isDisabled: disabled},
    state
  );

  useImperativeHandle(ref, () => inputRef.current!, []);

  const isActive = isFocused || isDragging;
  const thumbPercent = state.getThumbPercent(0);
  const thumbValue = state.values[0] ?? min;

  const allTickValues = useMemo<number[]>(() => {
    if (tickValues) {
      return tickValues;
    }

    if (ticksInterval) {
      const result: number[] = [];
      let current = min;
      while (current <= max) {
        result.push(current);
        current = parseFloat((current + ticksInterval).toFixed(10));
      }
      if (result[result.length - 1] !== max) {
        result.push(max);
      }
      return result;
    }

    if (ticks && ticks >= 2) {
      const range = max - min;
      return Array.from({length: ticks}, (_, i) => min + i * (range / (ticks - 1)));
    }

    return [];
  }, [ticks, ticksInterval, tickValues, min, max]);

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

  // Edge label opacity: fade out when value pill approaches that edge
  const minLabelOpacity = isActive
    ? Math.min(1, Math.max(0, (thumbPercent - 0.05) / 0.05))
    : 0;
  const maxLabelOpacity = isActive
    ? Math.min(1, Math.max(0, (0.95 - thumbPercent) / 0.05))
    : 0;

  return (
    <SliderWrapper {...groupProps} className={className}>
      <Flex
        position="absolute"
        justify="between"
        width="100%"
        inset="0"
        pointerEvents="none"
      >
        <EdgeLabel
          aria-hidden
          data-disabled={disabled || undefined}
          style={{opacity: minLabelOpacity}}
        >
          {getFormattedValue(min)}
        </EdgeLabel>
        <EdgeLabel
          aria-hidden
          data-disabled={disabled || undefined}
          style={{opacity: maxLabelOpacity}}
        >
          {getFormattedValue(max)}
        </EdgeLabel>
      </Flex>

      <TrackArea
        ref={trackRef}
        {...trackProps}
        disabled={disabled}
        hasTickLabels={showTickLabels && hasTicks}
      >
        <ValueLabel
          aria-hidden
          style={
            {
              '--thumb-pct': `${thumbPercent * 100}%`,
              '--thumb-offset': `${(2 * thumbPercent - 1) * 8}px`,
            } as React.CSSProperties
          }
          data-active={isActive || undefined}
          data-disabled={disabled || undefined}
        >
          {getFormattedValue(thumbValue)}
        </ValueLabel>

        <SliderTrackBar>
          <SliderFill
            data-disabled={disabled || undefined}
            style={{width: `${thumbPercent * 100}%`}}
          />

          {allTickValues.map((tickValue, index) => (
            <SliderTick
              key={tickValue}
              aria-hidden
              data-in-selection={tickValue <= thumbValue || undefined}
              data-disabled={disabled || undefined}
              data-first={index === 0 || undefined}
              data-last={index === allTickValues.length - 1 || undefined}
              style={{
                left: `${(state.getValuePercent(tickValue) * 100).toFixed(2)}%`,
              }}
            >
              {showTickLabels && (
                <SliderTickLabel>{getFormattedValue(tickValue)}</SliderTickLabel>
              )}
            </SliderTick>
          ))}
        </SliderTrackBar>

        <SliderThumbHitbox {...thumbProps} style={{left: `${thumbPercent * 100}%`}}>
          <SliderThumbVisual
            data-focused={isFocused || undefined}
            data-disabled={disabled || undefined}
          />
          <VisuallyHidden>
            <input ref={mergeRefs(inputRef, ref)} {...inputProps} name={name} />
          </VisuallyHidden>
        </SliderThumbHitbox>
      </TrackArea>
    </SliderWrapper>
  );
}

// --- Styled Components ---

const SliderWrapper = styled('div')`
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  white-space: nowrap;
  user-select: none;
`;

const TrackArea = styled('div', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'disabled',
})<{disabled: boolean; hasTickLabels: boolean}>`
  position: relative;
  width: 100%;
  padding-top: 22px;
  padding-bottom: ${p => (p.hasTickLabels ? '2em' : '6px')};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};

  ${p =>
    p.disabled &&
    css`
      pointer-events: none;
    `}
`;

const SliderTrackBar = styled('div')`
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: ${p => p.theme.radius.xs};
  background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  pointer-events: none;
`;

const SliderFill = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: inherit;
  background: ${p => p.theme.tokens.background.accent.vibrant};
  pointer-events: none;

  &[data-disabled] {
    opacity: ${p => p.theme.tokens.interactive.disabled};
  }
`;

const SliderThumbHitbox = styled('div')`
  position: absolute;
  /* 22px padding-top + 2px (half of 4px track) = 24px to track center */
  top: 24px;
  width: 32px;
  height: 32px;
  transform: translate(-50%, -50%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SliderThumbVisual = styled('div')`
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
  border: 1.5px solid ${p => p.theme.tokens.interactive.chonky.embossed.accent.chonk};
  pointer-events: none;
  flex-shrink: 0;
  transition: box-shadow 120ms ease;

  &[data-focused] {
    ${p => p.theme.focusRing()};
  }

  &[data-disabled] {
    border-color: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
    opacity: ${p => p.theme.tokens.interactive.disabled};
  }
`;

const SliderTick = styled('div')`
  position: absolute;
  top: 50%;
  transform: translate(-50%, -2px);
  width: 2px;
  height: 8px;
  border-radius: ${p => p.theme.radius['2xs']};
  background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  pointer-events: none;

  &[data-in-selection] {
    background: ${p => p.theme.tokens.background.accent.vibrant};
  }

  &[data-first] {
    border-top-left-radius: ${p => p.theme.radius.xs};
    border-bottom-left-radius: ${p => p.theme.radius.xs};
  }

  &[data-last] {
    border-top-right-radius: ${p => p.theme.radius.xs};
    border-bottom-right-radius: ${p => p.theme.radius.xs};
  }

  &[data-disabled] {
    opacity: ${p => p.theme.tokens.interactive.disabled};
  }
`;

const SliderTickLabel = styled('small')`
  display: inline-block;
  position: absolute;
  top: calc(100% + ${p => p.theme.space.xs});
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
  transform: translateX(-50%);

  [data-first] > & {
    transform: none;
  }

  [data-last] > & {
    transform: translateX(-100%);
  }
`;

const ValueLabel = styled('output')`
  position: absolute;
  top: 0;
  left: var(--thumb-pct, 50%);
  transform: translateX(calc(-1 * var(--thumb-pct, 50%) + var(--thumb-offset, 0px)))
    translateY(var(--thumb-y, 0px));
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  color: ${p => p.theme.tokens.content.primary};
  transition:
    background ${p => p.theme.motion.snap.moderate},
    color ${p => p.theme.motion.snap.moderate},
    padding ${p => p.theme.motion.snap.moderate},
    border-color ${p => p.theme.motion.snap.moderate},
    font-size ${p => p.theme.motion.snap.moderate};
  border: 1px solid transparent;
  border-radius: ${p => p.theme.radius.xs};
  padding: 0;
  line-height: 1;

  &[data-active] {
    background: ${p => p.theme.tokens.background.accent.vibrant};
    border-color: ${p => p.theme.tokens.interactive.chonky.embossed.accent.chonk};
    color: ${p => p.theme.tokens.content.onVibrant.light};
    font-size: ${p => p.theme.font.size.sm};
    padding: 1px ${p => p.theme.space['2xs']};
    --thumb-y: -4px;
  }

  &[data-disabled] {
    color: ${p => p.theme.tokens.content.disabled};
  }

  &[data-disabled][data-active] {
    background: transparent;
    border-color: transparent;
    color: ${p => p.theme.tokens.content.disabled};
    --thumb-y: -4px;
  }
`;

const EdgeLabel = styled('span')`
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.tokens.content.secondary};
  pointer-events: none;
  transition: opacity ${p => p.theme.motion.exit.slow};

  &[data-disabled] {
    color: ${p => p.theme.tokens.content.disabled};
  }
`;
