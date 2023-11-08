import {Component} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {space} from 'sentry/styles/space';

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

type State = {
  focused: boolean;
};

const TimePicker = styled(
  class TimePicker extends Component<Props, State> {
    state: State = {
      focused: false,
    };

    shouldComponentUpdate() {
      // This is necessary because when a change event happens,
      // the change is propagated up to the dropdown. This causes
      // a re-render of this component which in turn causes the
      // input element to lose focus. To get around losing focus,
      // we prevent the component from updating when one of the
      // inputs has focus. This is okay because the inputs will
      // keep track of their own values so we do not have to keep
      // track of it.
      return !this.state.focused;
    }

    handleFocus = () => {
      this.setState({focused: true});
    };

    handleBlur = () => {
      this.setState({focused: false});
    };

    render() {
      const {
        className,
        start,
        end,
        disabled,
        onChangeStart,
        onChangeEnd,
        hasStartErrors,
        hasEndErrors,
      } = this.props;

      return (
        <div className={classNames(className, 'rdrDateDisplay')}>
          <div>
            <Input
              type="time"
              key={start}
              defaultValue={start}
              className="rdrDateDisplayItem"
              data-test-id="startTime"
              aria-invalid={hasStartErrors}
              disabled={disabled}
              onFocus={this.handleFocus}
              onBlur={this.handleBlur}
              onChange={onChangeStart}
            />
          </div>

          <div>
            <Input
              type="time"
              defaultValue={end}
              key={end}
              className="rdrDateDisplayItem"
              data-test-id="endTime"
              disabled={disabled}
              aria-invalid={hasEndErrors}
              onFocus={this.handleFocus}
              onBlur={this.handleBlur}
              onChange={onChangeEnd}
            />
          </div>
        </div>
      );
    }
  }
)`
  &.rdrDateDisplay {
    display: grid;
    background: transparent;
    grid-template-columns: 48% 48%;
    grid-column-gap: 4%;
    align-items: center;
    color: ${p => p.theme.subText};
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
    background: ${p => p.theme.backgroundSecondary};
    border: 1px solid ${p => p.theme.border};
    color: ${p => p.theme.gray300};
    padding: ${space(0.25)} ${space(0.5)};
    box-shadow: none;
    font-variant-numeric: tabular-nums;

    &&.focus-visible {
      outline: none;
      border-color: ${p => p.theme.focusBorder};
      box-shadow: 0 0 0 1px ${p => p.theme.focusBorder};
    }

    &&[aria-invalid='true'] {
      outline: none;
      border-color: ${p => p.theme.error};
      box-shadow: 0 0 0 1px ${p => p.theme.error};
    }
  }
`;

export default TimePicker;
