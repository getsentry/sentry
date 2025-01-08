import {forwardRef, useCallback, useImperativeHandle, useMemo, useRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {useNumberFormatter} from '@react-aria/i18n';
import type {AriaSliderProps, AriaSliderThumbOptions} from '@react-aria/slider';
import {useSlider} from '@react-aria/slider';
import {useSliderState} from '@react-stately/slider';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

import {SliderThumb} from './thumb';

export interface SliderProps
  extends Omit<AriaSliderProps, 'minValue' | 'maxValue' | 'isDisabled'>,
    Pick<AriaSliderThumbOptions, 'autoFocus' | 'onFocus' | 'onBlur' | 'onFocusChange'> {
  /**
   * (This prop is now deprecated - slider ranges need to have consistent, evenly
   * spaced values. Use `min`/`max`/`step` instead.)
   *
   * Custom array of selectable values on the track. If specified, the `min`/`max`/`step`
   * props will be ignored. Make sure the array is sorted.
   * @deprecated
   */
  allowedValues?: number[];
  className?: string;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
  error?: boolean;
  /**
   * Apply custom formatting to output/tick labels. If only units are needed, use the
   * `formatOptions` prop instead.
   */
  formatLabel?: (value: number | '') => React.ReactNode;
  formatOptions?: Intl.NumberFormatOptions;
  max?: AriaSliderProps['maxValue'];
  min?: AriaSliderProps['minValue'];
  required?: boolean;
  /**
   * Whether to show value labels above the slider's thumbs. Note: if `label` is defined,
   * then thumb labels will be hidden in favor of the trailing output label.
   */
  showThumbLabels?: boolean;
  /**
   * Whether to show labels below track ticks.
   */
  showTickLabels?: boolean;
  /**
   * The values to display tick marks at, e.g. [2, 4] means there will be ticks at 2 & 4.
   *
   * See also: ticks, ticksInterval. The order of precedence is: ticks — ticksInterval —
   * tickValues. E.g. if tickValues is defined, both ticks & ticksEvery will be ignored.
   */
  tickValues?: number[];
  /**
   * Number of tick marks (including the outer min/max ticks) to display on the track.
   *
   * See also: ticksInterval, tickValues. The order of precedence is: ticks —
   * ticksInterval — tickValues. E.g. if tickValues is defined, both ticks & ticksEvery
   * will be ignored.
   */
  ticks?: number;
  /**
   * Interval between tick marks. This number should evenly divide the slider's range.
   *
   * See also: ticks, tickValues. The order of precedence is: ticks — ticksInterval —
   * tickValues. E.g. if tickValues is defined, both ticks & ticksEvery will be ignored.
   */
  ticksInterval?: number;
}

function BaseSlider(
  {
    // Slider/track props
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    disabledReason,
    error = false,
    required = false,
    ticks,
    ticksInterval,
    tickValues,
    showTickLabels = false,
    showThumbLabels = false,
    formatLabel,
    formatOptions,
    allowedValues,
    className,

    // Thumb props
    autoFocus,
    onFocus,
    onBlur,
    onFocusChange,

    ...props
  }: SliderProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement | HTMLInputElement[]>
) {
  const {label, value, defaultValue, onChange, onChangeEnd} = props;
  const ariaProps: AriaSliderProps = {
    ...props,
    step,
    minValue: min,
    maxValue: max,
    isDisabled: disabled,
    // Backward compatibility support for `allowedValues` prop. Since range sliders only
    // accept evenly spaced values (specified with `min`/`max`/`step`), we need to create
    // a custom set of internal values that act as indices for the `allowedValues` array.
    // For example, if `allowedValues` is [1, 2, 4, 8], then the corresponding internal
    // values are [0, 1, 2, 3]. If the first value (index 0) is selected, then onChange()
    // will be called with `onChange(allowedValues[0])`, i.e. `onChange(1)`.
    ...(allowedValues && {
      minValue: 0,
      maxValue: allowedValues.length - 1,
      step: 1,
      value: Array.isArray(value)
        ? value.map(allowedValues.indexOf)
        : allowedValues.indexOf(value ?? 0),
      defaultValue: Array.isArray(defaultValue)
        ? defaultValue.map(allowedValues.indexOf)
        : allowedValues.indexOf(defaultValue ?? 0),
      onChange: indexValue =>
        onChange?.(
          Array.isArray(indexValue)
            ? indexValue.map(i => allowedValues[i]!)
            : allowedValues[indexValue]!
        ),
      onChangeEnd: indexValue =>
        onChangeEnd?.(
          Array.isArray(indexValue)
            ? indexValue.map(i => allowedValues[i]!)
            : allowedValues[indexValue]!
        ),
    }),
  };

  const trackRef = useRef<HTMLDivElement>(null);
  const numberFormatter = useNumberFormatter(formatOptions);
  const state = useSliderState({...ariaProps, numberFormatter});

  const {groupProps, trackProps, labelProps, outputProps} = useSlider(
    ariaProps,
    state,
    trackRef
  );

  const allTickValues = useMemo(() => {
    if (tickValues) {
      return tickValues;
    }

    if (ticksInterval) {
      const result: number[] = [];
      let current = min;
      while (current <= max) {
        result.push(current);
        current += ticksInterval;
      }
      return result.concat([max]);
    }

    if (ticks) {
      const range = max - min;
      return [...new Array(ticks)].map((_, i) => min + i * (range / (ticks - 1)));
    }

    return [];
  }, [ticks, ticksInterval, tickValues, min, max]);

  const nThumbs = state.values.length;
  const refs = useRef<Array<HTMLInputElement>>([]);
  useImperativeHandle(forwardedRef, () => {
    if (nThumbs > 1) {
      return refs.current;
    }
    return refs.current[0]!;
  }, [nThumbs]);

  const getFormattedValue = useCallback(
    (val: number) => {
      // Special formatting when `allowedValues` is specified, in which case `val` acts
      // like an index for `allowedValues`.
      if (allowedValues) {
        return formatLabel
          ? formatLabel(allowedValues[val]!)
          : state.getFormattedValue(allowedValues[val]!);
      }

      return formatLabel ? formatLabel(val) : state.getFormattedValue(val);
    },
    [formatLabel, state, allowedValues]
  );

  const selectedRange =
    nThumbs > 1
      ? [Math.min(...state.values), Math.max(...state.values)]
      : [min, state.values[0]];

  return (
    <Tooltip
      title={disabledReason}
      disabled={!disabled}
      skipWrapper
      isHoverable
      position="bottom"
      offset={-15}
    >
      <SliderGroup {...groupProps} className={className}>
        {label && (
          <SliderLabelWrapper className="label-container">
            <SliderLabel {...labelProps}>{label}</SliderLabel>
            <SliderLabelOutput {...outputProps}>
              {nThumbs > 1
                ? `${getFormattedValue(selectedRange[0]!)}–${getFormattedValue(
                    selectedRange[1]!
                  )}`
                : getFormattedValue(selectedRange[1]!)}
            </SliderLabelOutput>
          </SliderLabelWrapper>
        )}

        <SliderTrack
          ref={trackRef}
          {...trackProps}
          disabled={disabled}
          hasThumbLabels={showThumbLabels && !label}
          hasTickLabels={showTickLabels && allTickValues.length > 0}
        >
          <SliderLowerTrack
            role="presentation"
            disabled={disabled}
            error={error}
            style={{
              left: `${state.getValuePercent(selectedRange[0]!) * 100}%`,
              right: `${100 - state.getValuePercent(selectedRange[1]!) * 100}%`,
            }}
          />

          {allTickValues.map((tickValue, index) => (
            <SliderTick
              key={tickValue}
              aria-hidden
              error={error}
              disabled={disabled}
              inSelection={
                tickValue >= selectedRange[0]! && tickValue <= selectedRange[1]!
              }
              style={{left: `${(state.getValuePercent(tickValue) * 100).toFixed(2)}%`}}
              justifyContent={
                index === 0
                  ? 'start'
                  : index === allTickValues.length - 1
                    ? 'end'
                    : 'center'
              }
            >
              {showTickLabels && (
                <SliderTickLabel>{getFormattedValue(tickValue)}</SliderTickLabel>
              )}
            </SliderTick>
          ))}

          {[...new Array(nThumbs)].map((_, index) => (
            <SliderThumb
              ref={node => {
                if (!node) {
                  return;
                }

                refs.current = [
                  ...refs.current.slice(0, index),
                  node,
                  ...refs.current.slice(index + 1),
                ];
              }}
              key={index}
              index={index}
              state={state}
              trackRef={trackRef}
              isDisabled={disabled}
              showLabel={showThumbLabels && !label}
              getFormattedValue={getFormattedValue}
              isRequired={required}
              autoFocus={autoFocus && index === 0}
              onFocus={onFocus}
              onBlur={onBlur}
              onFocusChange={onFocusChange}
              error={error}
            />
          ))}
        </SliderTrack>
      </SliderGroup>
    </Tooltip>
  );
}

const Slider = forwardRef(BaseSlider);

export {Slider};

const SliderGroup = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  white-space: nowrap;
`;

const SliderLabelWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1.5)};
`;

const SliderLabel = styled('label')`
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.textColor};
`;

const SliderLabelOutput = styled('output')`
  margin: 0;
  padding: 0;
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.subText};
`;

const SliderTrack = styled('div', {
  shouldForwardProp: prop =>
    prop !== 'disabled' && typeof prop === 'string' && isPropValid(prop),
})<{
  disabled: boolean;
  hasThumbLabels: boolean;
  hasTickLabels: boolean;
}>`
  position: relative;
  width: calc(100% - 2px);
  height: 3px;
  border-radius: 3px;
  background: ${p => p.theme.border};
  margin-left: 1px; /* to better align track with label */

  margin-bottom: ${p => (p.hasTickLabels ? '2em' : '0.5rem')};
  margin-top: ${p => (p.hasThumbLabels ? '2em' : '0.5rem')};

  ${p => p.disabled && `pointer-events: none;`}

  /* Users can click on the track to quickly jump to a value. We should extend the click
  area to make the action easier. */
  &::before {
    content: '';
    width: 100%;
    height: 1.5rem;
    border-radius: 50%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
`;

const SliderLowerTrack = styled('div')<{disabled: boolean; error: boolean}>`
  position: absolute;
  height: inherit;
  border-radius: inherit;
  background: ${p => p.theme.active};
  pointer-events: none;

  ${p => p.error && `background: ${p.theme.error};`}
  ${p => p.disabled && `background: ${p.theme.subText};`}
`;

const SliderTick = styled('div')<{
  disabled: boolean;
  error: boolean;
  inSelection: boolean;
  justifyContent: string;
}>`
  display: flex;
  justify-content: ${p => p.justifyContent};
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 6px;
  border-radius: 2px;
  background: ${p => p.theme.translucentBorder};

  ${p =>
    p.inSelection &&
    `background: ${
      p.disabled ? p.theme.subText : p.error ? p.theme.error : p.theme.active
    };`}
`;

const SliderTickLabel = styled('small')`
  display: inline-block;
  position: absolute;
  top: calc(100% + ${space(1)});
  margin: 0 -1px;

  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;
