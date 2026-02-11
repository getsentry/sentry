import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {InputGroup, type InputProps} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconArrow} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {clamp} from 'sentry/utils/profiling/colors/utils';

// @TODO(jonasbadalic): Not sure this needs to be its own component,
// given that we mostly wrap around the NumberInput component.
// We could potentially move the drag logic to the NumberInput component
// and remove the need for this component altogether. The API would look something like
// <NumberInput trailingItems={<NumberDragInput />} /> or similar, but that diverges from
// the current API where we have a more composable approach for the trailing items.
export interface NumberDragInput extends Omit<InputProps, 'type' | 'onPointerMove'> {
  /**
   * Determines the axis of the drag input. Defaults to `x`
   */
  axis?: 'x' | 'y';

  /**
   * The maximum value of the input (inclusive)
   */
  max?: number;
  /**
   * The minimum value of the input (inclusive)
   */
  min?: number;

  /**
   * The multiplier for the value when the shift key is held down
   */
  shiftKeyMultiplier?: number;
}

export function NumberDragInput({
  axis = 'x',
  shiftKeyMultiplier = 10,
  ...props
}: NumberDragInput) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if ((event.movementX === 0 && event.movementY === 0) || !inputRef.current) {
        return;
      }

      const step = parseFloat(props.step?.toString() ?? '1');

      if (isNaN(step)) {
        throw new TypeError('Step must be of type number, got ' + props.step);
      }

      const pointerDelta = axis === 'x' ? event.movementX : event.movementY * -1;
      const pointerDeltaOne =
        pointerDelta > 0 ? Math.ceil(pointerDelta / 100) : Math.floor(pointerDelta / 100);
      const deltaStep =
        pointerDeltaOne * ((event.shiftKey ? shiftKeyMultiplier : step) ?? 1);

      const min = props.min ?? Number.NEGATIVE_INFINITY;
      const max = props.max ?? Number.POSITIVE_INFINITY;

      const value = clamp(Number(inputRef.current.value) + deltaStep, min, max);
      setInputValueAndDispatchChange(inputRef.current, value.toString());
    },
    [axis, props.min, props.max, props.step, shiftKeyMultiplier]
  );

  const onPointerUp = useCallback(() => {
    document.exitPointerLock();

    // Cleanup handlers
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      // Request pointer lock and add move and pointer up handlers
      // that release the lock and cleanup handlers
      event.currentTarget.requestPointerLock();
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [onPointerMove, onPointerUp]
  );

  const onKeyDownProp = props.onKeyDown;
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDownProp?.(event);

      if (!inputRef.current || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
        return;
      }

      event.preventDefault();
      const value = parseFloat(inputRef.current.value);
      const step = parseFloat(props.step?.toString() ?? '1');
      const min = props.min ?? Number.NEGATIVE_INFINITY;
      const max = props.max ?? Number.POSITIVE_INFINITY;
      const newValue = clamp(value + (event.key === 'ArrowUp' ? step : -step), min, max);
      setInputValueAndDispatchChange(inputRef.current, newValue.toString());
    },
    [onKeyDownProp, props.min, props.max, props.step]
  );

  return (
    <InputGroup>
      <InputGroup.Input ref={inputRef} type="text" {...props} onKeyDown={onKeyDown} />
      <InputGroup.TrailingItems>
        <Tooltip
          title={tct('Drag to adjust threshold[break]You can hold shift to fine tune', {
            break: <br />,
          })}
          skipWrapper
        >
          <Flex
            direction={axis === 'x' ? 'row' : 'column'}
            gap="2xs"
            onPointerDown={onPointerDown}
          >
            <VerySmallIconArrow direction={axis === 'x' ? 'left' : 'up'} />
            <VerySmallIconArrow direction={axis === 'x' ? 'right' : 'down'} />
          </Flex>
        </Tooltip>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

function setInputValueAndDispatchChange(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
    input,
    value
  );
  input.dispatchEvent(new Event('input', {bubbles: true}));
}

// We need smaller icons than the smallest we have available
const VerySmallIconArrow = styled(IconArrow)`
  width: 8px;
  height: 8px;
`;
