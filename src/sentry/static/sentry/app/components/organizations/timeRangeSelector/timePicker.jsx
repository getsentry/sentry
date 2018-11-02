import PropTypes from 'prop-types';
import React from 'react';
import styled, {cx} from 'react-emotion';

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
          <div>
            <Input
              type="time"
              className="rdrDateDisplayItem"
              data-test-id="startTime"
              disabled={disabled}
              value={start}
              onChange={onChangeStart}
            />
          </div>

          <div>
            <Input
              type="time"
              className="rdrDateDisplayItem"
              data-test-id="endTime"
              disabled={disabled}
              value={end}
              onChange={onChangeEnd}
            />
          </div>
        </div>
      );
    }
  }
)`
  display: grid;
  grid-template-columns: 48% 48%;
  grid-column-gap: 4%;
  align-items: center;
  font-size: 0.875em;
  color: ${p => p.theme.gray3};
`;

const Input = styled('input')`
  &.rdrDateDisplayItem {
    width: 100%;
    padding-left: 5%;
    background: ${p => p.theme.offWhite};
    border: 1px solid ${p => p.theme.borderLight};
    color: ${p => p.theme.gray2};
    box-shadow: none;
  }
`;

export default TimePicker;
