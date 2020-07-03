import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styled from '@emotion/styled';

const TimePicker = styled(
  class TimePicker extends React.Component {
    static propTypes = {
      onChangeStart: PropTypes.func.isRequired,
      onChangeEnd: PropTypes.func.isRequired,

      // Takes string in 24 hour format
      start: PropTypes.string,
      // Takes string in 24 hour format
      end: PropTypes.string,

      // Should inputs be disabled
      disabled: PropTypes.bool,
    };

    render() {
      const {className, start, end, disabled, onChangeStart, onChangeEnd} = this.props;
      return (
        <div className={classNames(className, 'rdrDateDisplay')}>
          <div>
            <Input
              type="time"
              key={start}
              defaultValue={start}
              className="rdrDateDisplayItem"
              data-test-id="startTime"
              disabled={disabled}
              onBlur={onChangeStart}
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
              onBlur={onChangeEnd}
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
    font-size: 0.875em;
    color: ${p => p.theme.gray600};
    width: 70%;
    padding: 0;
  }
`;

const Input = styled('input')`
  &.rdrDateDisplayItem {
    width: 100%;
    padding-left: 5%;
    background: ${p => p.theme.gray100};
    border: 1px solid ${p => p.theme.borderLight};
    color: ${p => p.theme.gray500};
    box-shadow: none;
  }
`;

export default TimePicker;
