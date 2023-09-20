import {forwardRef, useRef} from 'react';
import styled from '@emotion/styled';
import {AriaSliderThumbOptions, useSliderThumb} from '@react-aria/slider';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {SliderState} from '@react-stately/slider';

import {space} from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';

export interface SliderThumbProps extends Omit<AriaSliderThumbOptions, 'inputRef'> {
  getFormattedValue: (value: number) => React.ReactNode;
  state: SliderState;
  error?: boolean;
  showLabel?: boolean;
}

function BaseSliderThumb(
  {
    index,
    state,
    trackRef,
    error = false,
    getFormattedValue,
    showLabel,
    ...props
  }: SliderThumbProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {thumbProps, inputProps, isDisabled, isFocused} = useSliderThumb(
    {...props, index, trackRef, inputRef, validationState: error ? 'invalid' : 'valid'},
    state
  );

  return (
    <SliderThumbWrap
      {...thumbProps}
      isDisabled={isDisabled}
      isFocused={isFocused}
      error={error}
    >
      {showLabel && (
        <SliderThumbLabel
          aria-hidden
          style={{
            // Align thumb label with the track's edges. At 0% (min value) the label's
            // leading edge should align with the track's leading edge. At 100% (max value)
            // the label's trailing edge should align with the track's trailing edge.
            left: `${state.getThumbPercent(index ?? 0) * 100}%`,
            transform: `translateX(${-state.getThumbPercent(index ?? 0) * 100}%)`,
          }}
        >
          {getFormattedValue(state.values[index ?? 0])}
        </SliderThumbLabel>
      )}
      <VisuallyHidden>
        <input ref={mergeRefs([inputRef, forwardedRef])} {...inputProps} />
      </VisuallyHidden>
    </SliderThumbWrap>
  );
}

const SliderThumb = forwardRef(BaseSliderThumb);

export {SliderThumb};

const SliderThumbWrap = styled('div')<{
  error: boolean;
  isDisabled: boolean;
  isFocused: boolean;
}>`
  top: 50%;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: ${p => p.theme.active};
  color: ${p => p.theme.activeText};
  border: solid 2px ${p => p.theme.background};
  cursor: pointer;
  transition:
    box-shadow 0.1s,
    background 0.1s;

  &:hover {
    background: ${p => p.theme.activeHover};
  }

  ${p =>
    p.error &&
    `
    background: ${p.theme.error};
    color: ${p.theme.errorText};

    &:hover {
      background: ${p.theme.error};
    }
  `}

  ${p =>
    p.isFocused &&
    `
      box-shadow: 0 0 0 2px ${p.error ? p.theme.errorFocus : p.theme.focus};
      z-index:1;
    `}

    ${p =>
    p.isDisabled &&
    `
        cursor: initial;
        background: ${p.theme.subText};
        color: ${p.theme.subText};

        &:hover {
          background: ${p.theme.subText};
        }
      `};

  /* Extend click area */
  &::before {
    content: '' / '';
    width: calc(100% + 0.5rem);
    height: calc(100% + 0.5rem);
    border-radius: 50%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
`;

const SliderThumbLabel = styled('span')`
  position: absolute;
  bottom: calc(100% + ${space(0.25)});

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;
