import {lazy, Suspense} from 'react';
import type {OnChangeProps} from 'react-date-range';
import styled from '@emotion/styled';
import moment from 'moment';

import DropdownMenu from 'sentry/components/dropdownMenu';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconCalendar} from 'sentry/icons';
import {inputStyles} from 'sentry/styles/input';
import space from 'sentry/styles/space';

import InputField, {onEvent} from './inputField';

type Props = Omit<InputField['props'], 'field'>;

function handleChangeDate(
  onChange: onEvent,
  onBlur: onEvent,
  date: OnChangeProps,
  close: Function
) {
  onChange(date);
  onBlur(date);

  // close dropdown menu
  close();
}

const Calendar = lazy(() => import('./calendarField'));

export default function DatePickerField(props: Props) {
  return (
    <InputField
      {...props}
      field={({onChange, onBlur, value, id}) => {
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
                    <Suspense
                      fallback={
                        <Placeholder width="332px" height="282px">
                          <LoadingIndicator />
                        </Placeholder>
                      }
                    >
                      <Calendar
                        date={inputValue}
                        onChange={date =>
                          handleChangeDate(onChange, onBlur, date, actions.close)
                        }
                      />
                    </Suspense>
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
  background: ${p => p.theme.background};
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
