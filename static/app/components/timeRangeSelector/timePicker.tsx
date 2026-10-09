import {useCallback, useEffect, useRef} from 'react';
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
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  // Track focus in a ref so we know whether to apply incoming prop changes
  const focusedRef = useRef(false);

  // When start/end props change externally (i.e. not because the user is
  // currently typing), reset the input values imperatively. We use a DOM ref
  // rather than React state to avoid the derived-state anti-pattern while
  // still preventing the re-key/remount that caused focus loss in the old
  // class-component implementation.
  useEffect(() => {
    if (!focusedRef.current) {
      if (startInputRef.current) {
        startInputRef.current.value = start ?? '';
      }
      if (endInputRef.current) {
        endInputRef.current.value = end ?? '';
      }
    }
  }, [start, end]);

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
  }, []);

  return (
    <div className={classNames(className, 'rdrDateDisplay')}>
      <div>
        <Input
          ref={startInputRef}
          type="time"
          defaultValue={start}
          className="rdrDateDisplayItem"
          data-test-id="startTime"
          aria-invalid={hasStartErrors}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={onChangeStart}
        />
      </div>

      <div>
        <Input
          ref={endInputRef}
          type="time"
          defaultValue={end}
          className="rdrDateDisplayItem"
          data-test-id="endTime"
          aria-invalid={hasEndErrors}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={onChangeEnd}
        />
      </div>
    </div>
  );
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
