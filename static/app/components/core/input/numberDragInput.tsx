import {forwardRef, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {InputGroup, type InputProps} from 'sentry/components/core/input/inputGroup';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

      const step = parseInt(props.step?.toString() ?? '1', 10);

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

      const value = clamp(Number(inputRef.current!.value) + deltaStep, min, max);
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

  return (
    <InputGroup>
      <InputGroup.Input ref={inputRef} type="number" {...props} />
      <InputGroup.TrailingItems>
        <Tooltip
          title={tct('Drag to adjust threshold[break]You can hold shift to fine tune', {
            break: <br />,
          })}
          skipWrapper
        >
          <TrailingItemsContainer
            onPointerDown={onPointerDown}
            layout={axis === 'x' ? 'horizontal' : 'vertical'}
          >
            <VerySmallIconArrow direction={axis === 'x' ? 'left' : 'up'} />
            <VerySmallIconArrow direction={axis === 'x' ? 'right' : 'down'} />
          </TrailingItemsContainer>
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

// forwardRef is required so that skipWrapper can be applied by the tooltip
const TrailingItemsContainer = styled(
  forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div {...props} ref={ref} />
  ))
)<{
  layout: 'vertical' | 'horizontal';
}>`
  display: flex;
  flex-direction: ${p => (p.layout === 'vertical' ? 'column' : 'row')};
  gap: ${space(0.25)};
`;
