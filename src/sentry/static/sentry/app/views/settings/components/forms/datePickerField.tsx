import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import {Calendar} from 'react-date-range';
import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';

import {inputStyles} from 'app/styles/input';
import DropdownMenu from 'app/components/dropdownMenu';
import {IconCalendar} from 'app/icons';
import space from 'app/styles/space';

import InputField, {onEvent} from './inputField';

type Props = Omit<InputField['props'], 'field'>;

function handleChangeDate(
  onChange: onEvent,
  onBlur: onEvent,
  date: Date,
  close: Function
) {
  onChange(date);
  onBlur(date);

  // close dropdown menu
  close();
}

export default function DatePickerField(props: Props) {
  return (
    <InputField
      {...props}
      field={({onChange, onBlur, value, disabled, id}) => {
        const dateObj = new Date(value);
        const inputValue = !isNaN(dateObj.getTime()) ? dateObj : new Date();
        const dateString = moment(inputValue).format('LL');

        return (
          <DropdownMenu keepMenuOpen>
            {({isOpen, getRootProps, getActorProps, getMenuProps, actions}) => (
              <div {...getRootProps()}>
                <InputWrapper id={id} {...getActorProps()} isOpen={isOpen}>
                  <StyledInput readOnly value={dateString} />
                  <CalendarIcon>
                    <IconCalendar />
                  </CalendarIcon>
                </InputWrapper>

                {isOpen && (
                  <CalendarMenu {...getMenuProps()}>
                    <Calendar
                      disabled={disabled}
                      date={inputValue}
                      onChange={date =>
                        handleChangeDate(onChange, onBlur, date, actions.close)
                      }
                    />
                  </CalendarMenu>
                )}
              </div>
            )}
          </DropdownMenu>
        );
      }}
    />
  );
}

type InputWrapperProps = {
  isOpen: boolean;
};

const InputWrapper = styled('div')<InputWrapperProps>`
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
  background: ${p => p.theme.white};
  position: absolute;
  left: 0;
  border: 1px solid ${p => p.theme.border};
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
