import {Box} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {defined} from 'app/utils';

const MultipleCheckboxWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const Label = styled('label')`
  font-weight: normal;
  white-space: nowrap;
  margin-right: 10px;
  margin-bottom: 10px;
  width: 20%;
`;

const CheckboxLabel = styled('span')`
  margin-left: 3px;
`;

export default class MultipleCheckbox extends React.Component {
  static propTypes = {
    value: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
    onChange: PropTypes.func,
    disabled: PropTypes.bool,
    choices: PropTypes.array.isRequired,
  };

  onChange = (selectedValue, e) => {
    const {value, onChange} = this.props;
    let newValue;

    if (typeof onChange !== 'function') {
      return;
    }

    if (e.target.checked) {
      newValue = value ? [...value, selectedValue] : [value];
    } else {
      newValue = value.filter(v => v !== selectedValue);
    }

    onChange(newValue, e);
  };

  render() {
    const {disabled, choices, value} = this.props;

    return (
      <MultipleCheckboxWrapper>
        {choices.map(([choiceValue, choiceLabel]) => (
          <Box key={choiceValue} width={[1, 1 / 2, 1 / 3, 1 / 4]}>
            <Label>
              <input
                type="checkbox"
                value={choiceValue}
                onChange={this.onChange.bind(this, choiceValue)}
                disabled={disabled}
                checked={defined(value) && value.indexOf(choiceValue) !== -1}
              />
              <CheckboxLabel>{choiceLabel}</CheckboxLabel>
            </Label>
          </Box>
        ))}
      </MultipleCheckboxWrapper>
    );
  }
}
