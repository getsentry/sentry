import PropTypes from 'prop-types';
import React from 'react';
import styled, {cx} from 'react-emotion';

import space from 'app/styles/space';

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
        <div className={cx(className, 'rdrDateDisplay')}>
          <TimeBox>
            <Input
              type="time"
              className="rdrDateDisplayItem"
              data-test-id="startTime"
              disabled={disabled}
              value={start}
              onChange={onChangeStart}
            />
          </TimeBox>

          <TimeBox>
            <Input
              type="time"
              className="rdrDateDisplayItem"
              data-test-id="endTime"
              disabled={disabled}
              value={end}
              onChange={onChangeEnd}
            />
          </TimeBox>
        </div>
      );
    }
  }
)`
  display: flex;
  color: ${p => p.theme.purple};
`;
const TimeBox = styled('div')`
  flex: 1;

  &:first-child {
    padding-right: 0.833em;
  }
`;
const Input = styled('input')`
  padding-left: ${space(
    4
  )}; /* this is to center input on Chrome, have not checked browser consistency yet */
  width: 100%;
`;

export default TimePicker;
