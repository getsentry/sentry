import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import moment from 'moment';

import {DatePicker} from 'sentry/components/calendar';
import FormField from 'sentry/components/forms/formField';
import Input from 'sentry/components/input';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IconCalendar} from 'sentry/icons';
import useOverlay from 'sentry/utils/useOverlay';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps, OnEvent} from './inputField';

interface DatePickerFieldProps extends Omit<InputFieldProps, 'field'> {}

function handleChangeDate(
  onChange: OnEvent,
  onBlur: OnEvent,
  date: Date,
  close: Function
) {
  onChange(date);
  onBlur(date);

  // close dropdown menu
  close();
}

export default function DatePickerField(props: DatePickerFieldProps) {
  const {
    isOpen,
    state: overlayState,
    triggerProps,
    overlayProps,
  } = useOverlay({position: 'bottom-start'});
  const theme = useTheme();

  return (
    <FormField {...props}>
      {({children: _children, onChange, onBlur, value, id, size, ...inputProps}) => {
        const dateObj = new Date(value);
        const inputValue = !isNaN(dateObj.getTime()) ? dateObj : new Date();
        const dateString = moment(inputValue).format('LL');

        return (
          <div>
            <InputWrapper id={id}>
              <StyledInput
                {...inputProps}
                {...triggerProps}
                aria-haspopup="dialog"
                size={size}
                value={dateString}
                readOnly
              />
              <StyledIconCalendar inputSize={size} size={size === 'xs' ? 'xs' : 'sm'} />
            </InputWrapper>
            {isOpen && (
              <FocusScope contain restoreFocus autoFocus>
                <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
                  <StyledOverlay>
                    <DatePicker
                      date={inputValue}
                      onChange={date =>
                        handleChangeDate(onChange, onBlur, date, overlayState.close)
                      }
                    />
                  </StyledOverlay>
                </PositionWrapper>
              </FocusScope>
            )}
          </div>
        );
      }}
    </FormField>
  );
}

const InputWrapper = styled('div')`
  position: relative;
`;

const StyledInput = styled(Input)`
  text-align: left;
  padding-right: ${p => `calc(
  ${p.theme.formPadding[p.size ?? 'md'].paddingRight}px * 1.5 +
  ${p.theme.iconSizes.sm}
)`};

  &:focus:not(.focus-visible) {
    border-color: ${p => p.theme.border};
    box-shadow: inset ${p => p.theme.dropShadowMedium};
  }
`;

const StyledOverlay = styled(Overlay)`
  .rdrMonthAndYearWrapper {
    height: 50px;
    padding-top: 0;
  }
`;

const StyledIconCalendar = styled(IconCalendar, {
  shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
})<{inputSize?: InputFieldProps['size']}>`
  position: absolute;
  top: 50%;
  right: ${p => p.theme.formPadding[p.inputSize ?? 'md'].paddingRight}px;
  transform: translateY(-50%);
`;
