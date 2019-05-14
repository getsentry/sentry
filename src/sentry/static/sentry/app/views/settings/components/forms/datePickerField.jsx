import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import {Calendar} from 'react-date-range';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {inputStyles} from 'app/styles/input';
import DropdownMenu from 'app/components/dropdownMenu';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

import InputField from './inputField';

export default class DatePickerField extends React.Component {
  onChange = (onChange, onBlur, date) => {
    onChange(date, {});
    onBlur(date, {});
  };

  render() {
    return (
      <InputField
        {...this.props}
        field={({onChange, onBlur, value, disabled, name, id, ...props}) => {
          const inputValue = !value ? new Date() : new Date(value);
          const dateString = moment(inputValue).format('lll');

          return (
            <DropdownMenu>
              {({isOpen, getRootProps, getActorProps, getMenuProps}) => (
                <DatePickerWrapper {...getRootProps({isStyled: true})}>
                  <InputWrapper
                    name={id}
                    id={id}
                    {...getActorProps({isStyled: true})}
                    isOpen={isOpen}
                  >
                    <StyledInput readOnly value={dateString} />
                    <CalendarIcon>
                      <InlineSvg src="icon-calendar" />
                    </CalendarIcon>
                  </InputWrapper>

                  {isOpen && (
                    <CalendarMenu {...getMenuProps({isStyled: true})}>
                      <Calendar
                        disabled={disabled}
                        date={!value ? new Date() : new Date(value)}
                        onChange={date => this.onChange(onChange, onBlur, date)}
                      />
                    </CalendarMenu>
                  )}
                </DatePickerWrapper>
              )}
            </DropdownMenu>
          );
        }}
      />
    );
  }
}

const DatePickerWrapper = styled('div')``;
const InputWrapper = styled('div')`
  ${inputStyles}
  cursor: text;
  display: flex;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  ${p => p.isOpen && 'border-bottom-left-radius: 0'}
`;

const StyledInput = styled('input')`
  border: none;
  outline: none;
  flex: 1;
`;

const CalendarMenu = styled('div')`
  display: flex;
  background: white;
  position: absolute;
  left: 0;
  border: 1px solid ${p => p.theme.borderDark};
  border-top: none;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu};
  margin-top: -1px;

  .rdrMonthAndYearWrapper {
    height: 50px;
    padding-top: 0;
  }
`;

const CalendarIcon = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
`;
