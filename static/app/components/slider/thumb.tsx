import {useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaSliderThumbOptions} from '@react-aria/slider';
import {useSliderThumb} from '@react-aria/slider';
import {mergeRefs} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {SliderState} from '@react-stately/slider';

import {space} from 'sentry/styles/space';

interface SliderThumbProps extends Omit<AriaSliderThumbOptions, 'inputRef'> {
  getFormattedValue: (value: number) => React.ReactNode;
  state: SliderState;
  error?: boolean;
  ref?: React.Ref<HTMLInputElement>;
  showLabel?: boolean;
}

export function SliderThumb({
  index,
  state,
  trackRef,
  error = false,
  getFormattedValue,
  showLabel,
  ref,
  ...props
}: SliderThumbProps) {
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
          {getFormattedValue(state.values[index ?? 0]!)}
        </SliderThumbLabel>
      )}
      <VisuallyHidden>
        <input ref={mergeRefs(inputRef, ref)} {...inputProps} />
      </VisuallyHidden>
    </SliderThumbWrap>
  );
}

const SliderThumbWrap = styled('div')<{
  error: boolean;
  isDisabled: boolean;
  isFocused: boolean;
}>`
  top: 50%;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: ${p => p.theme.tokens.interactive.link.accent.active};
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
  border: solid 2px ${p => p.theme.tokens.background.primary};
  cursor: pointer;
  transition:
    box-shadow 0.1s,
    background 0.1s;

  &:hover {
    background: ${p => p.theme.tokens.interactive.link.accent.hover};
  }

  ${p =>
    p.error &&
    css`
      background: ${p.theme.tokens.content.danger};
      color: ${p.theme.tokens.content.danger};

      &:hover {
        background: ${p.theme.tokens.content.danger};
      }
    `}

  ${p =>
    p.isFocused &&
    css`
      box-shadow: 0 0 0 2px ${p.theme.tokens.focus[p.error ? 'invalid' : 'default']};
      z-index: 1;
    `}

    ${p =>
    p.isDisabled &&
    css`
      cursor: initial;
      background: ${p.theme.tokens.content.disabled};
      color: ${p.theme.tokens.content.disabled};

      &:hover {
        background: ${p.theme.tokens.content.disabled};
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

  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-variant-numeric: tabular-nums;
`;
