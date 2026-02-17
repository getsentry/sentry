import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconHide} from 'sentry/icons/iconHide';
import {IconShow} from 'sentry/icons/iconShow';
import {t} from 'sentry/locale';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

export function PasswordField({
  onChange,
  disabled,
  ...props
}: BaseFieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur' | 'disabled'> & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean | string;
  }) {
  const [isFieldVisible, setisFieldVisible] = useState(false);
  const autoSaveContext = useAutoSaveContext();
  const indicator = useFieldStateIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {fieldProps => {
        const input = (
          <InputGroup>
            <InputGroup.Input
              {...fieldProps}
              {...props}
              type={isFieldVisible ? 'text' : 'password'}
              aria-disabled={isDisabled}
              readOnly={isDisabled}
              onChange={e => onChange(e.target.value)}
            />
            <InputGroup.TrailingItems>
              <Button
                size="xs"
                priority="transparent"
                aria-label={isFieldVisible ? t('Hide password') : t('Show password')}
                onClick={() => setisFieldVisible(v => !v)}
              >
                {isFieldVisible ? <IconShow size="xs" /> : <IconHide size="xs" />}
              </Button>
              {indicator}
            </InputGroup.TrailingItems>
          </InputGroup>
        );

        if (disabledReason) {
          return (
            <Tooltip skipWrapper title={disabledReason}>
              {input}
            </Tooltip>
          );
        }

        return input;
      }}
    </BaseField>
  );
}
