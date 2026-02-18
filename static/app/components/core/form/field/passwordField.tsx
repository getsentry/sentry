import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {InputField} from '@sentry/scraps/form/field/inputField';
import {type InputProps} from '@sentry/scraps/input';

import {IconHide} from 'sentry/icons/iconHide';
import {IconShow} from 'sentry/icons/iconShow';
import {t} from 'sentry/locale';

import {type BaseFieldProps} from './baseField';

export function PasswordField(
  props: BaseFieldProps &
    Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur' | 'disabled'> & {
      onChange: (value: string) => void;
      value: string;
      disabled?: boolean | string;
    }
) {
  const [isFieldVisible, setisFieldVisible] = useState(false);

  return (
    <InputField
      {...props}
      type={isFieldVisible ? 'text' : 'password'}
      trailingItems={
        <Button
          size="xs"
          priority="transparent"
          icon={isFieldVisible ? <IconShow size="xs" /> : <IconHide size="xs" />}
          aria-label={isFieldVisible ? t('Hide password') : t('Show password')}
          onClick={() => setisFieldVisible(v => !v)}
        />
      }
    />
  );
}
