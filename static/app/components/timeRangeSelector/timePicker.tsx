import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

type Props = {
  onChangeEnd: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeStart: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  // Takes string in 24 hour format
  end?: string;
  hasEndErrors?: boolean;
  hasStartErrors?: boolean;
  // Takes string in 24 hour format
  start?: string;
};

function TimePickerImpl({
  className,
  start,
  end,
  onChangeStart,
  onChangeEnd,
  hasStartErrors,
  hasEndErrors,
}: Props) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  useSyncUnfocusedValue(startRef, start);
  useSyncUnfocusedValue(endRef, end);

  return (
    <div className={classNames(className, 'rdrDateDisplay')}>
      <div>
        <Input
          ref={startRef}
          type="time"
          defaultValue={start}
          className="rdrDateDisplayItem"
          data-test-id="startTime"
          aria-invalid={hasStartErrors}
          onChange={onChangeStart}
        />
      </div>

      <div>
        <Input
          ref={endRef}
          type="time"
          defaultValue={end}
          className="rdrDateDisplayItem"
          data-test-id="endTime"
          aria-invalid={hasEndErrors}
          onChange={onChangeEnd}
        />
      </div>
    </div>
  );
}

/**
 * The parent ignores partial or invalid times and keeps its last valid value,
 * so the inputs stay uncontrolled to hold what the user is typing. New values
 * are only written to an input that doesn't have focus, otherwise the parent
 * echoing a keystroke back would overwrite the in-progress edit.
 */
function useSyncUnfocusedValue(
  ref: React.RefObject<HTMLInputElement | null>,
  value: string | undefined
) {
  useEffect(() => {
    const input = ref.current;
    if (input && input !== document.activeElement) {
      input.value = value ?? '';
    }
  }, [ref, value]);
}

export const TimePicker = styled(TimePickerImpl)`
  &.rdrDateDisplay {
    display: grid;
    background: transparent;
    grid-template-columns: 48% 48%;
    grid-column-gap: 4%;
    align-items: center;
    color: ${p => p.theme.tokens.content.secondary};
    width: 100%;
    padding: 0;
  }
`;

const Input = styled('input')`
  &::-webkit-calendar-picker-indicator {
    display: none;
  }

  &.rdrDateDisplayItem {
    width: 100%;
    background: ${p => p.theme.tokens.background.secondary};
    border: 1px solid ${p => p.theme.tokens.border.primary};
    color: ${p => p.theme.tokens.content.secondary};
    padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
    box-shadow: none;
    font-variant-numeric: tabular-nums;

    &&:focus-visible {
      outline: none;
      border-color: ${p => p.theme.tokens.focus.default};
      box-shadow: 0 0 0 1px ${p => p.theme.tokens.focus.default};
    }

    &&[aria-invalid='true'] {
      outline: none;
      border-color: ${p => p.theme.tokens.focus.invalid};
      box-shadow: 0 0 0 1px ${p => p.theme.tokens.focus.invalid};
    }
  }
`;
