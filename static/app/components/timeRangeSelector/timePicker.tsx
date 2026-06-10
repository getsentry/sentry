import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

type Props = {
  onChangeEnd: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeStart: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  // Should inputs be disabled
  disabled?: boolean;
  // Takes string in 24 hour format
  end?: string;
  hasEndErrors?: boolean;
  hasStartErrors?: boolean;
  // Takes string in 24 hour format
  start?: string;
};

export const TimePicker = styled(function TimePicker({
  className,
  start,
  end,
  disabled,
  onChangeStart,
  onChangeEnd,
  hasStartErrors,
  hasEndErrors,
}: Props) {
  const [localStart, setLocalStart] = useState(start ?? '');
  const [localEnd, setLocalEnd] = useState(end ?? '');

  // Sync local state when props change from parent (e.g. date range selection
  // resets times to 00:00 / 23:59)
  useEffect(() => {
    setLocalStart(start ?? '');
  }, [start]);

  useEffect(() => {
    setLocalEnd(end ?? '');
  }, [end]);

  return (
    <div className={classNames(className, 'rdrDateDisplay')}>
      <div>
        <Input
          type="time"
          value={localStart}
          className="rdrDateDisplayItem"
          data-test-id="startTime"
          aria-invalid={hasStartErrors}
          disabled={disabled}
          onChange={e => {
            setLocalStart(e.target.value);
            onChangeStart(e);
          }}
        />
      </div>

      <div>
        <Input
          type="time"
          value={localEnd}
          className="rdrDateDisplayItem"
          data-test-id="endTime"
          disabled={disabled}
          aria-invalid={hasEndErrors}
          onChange={e => {
            setLocalEnd(e.target.value);
            onChangeEnd(e);
          }}
        />
      </div>
    </div>
  );
})`
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
