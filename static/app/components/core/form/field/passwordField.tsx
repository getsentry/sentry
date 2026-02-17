import {useState} from 'react';
import styled from '@emotion/styled';

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
  const [isVisible, setIsVisible] = useState(false);
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
              type={isVisible ? 'text' : 'password'}
              aria-disabled={isDisabled}
              readOnly={isDisabled}
              onChange={e => onChange(e.target.value)}
            />
            <InputGroup.TrailingItems>
              <ToggleButton
                type="button"
                aria-label={isVisible ? t('Hide password') : t('Show password')}
                onClick={() => setIsVisible(v => !v)}
              >
                {isVisible ? <IconHide size="xs" /> : <IconShow size="xs" />}
              </ToggleButton>
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

const ToggleButton = styled('button')`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${p => p.theme.tokens.content.muted};
  display: flex;
  align-items: center;

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;
