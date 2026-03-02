import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {InputField} from '@sentry/scraps/form/field/inputField';

import {IconHide} from 'sentry/icons/iconHide';
import {IconShow} from 'sentry/icons/iconShow';
import {t} from 'sentry/locale';

import type {InputFieldProps} from './inputField';

export function PasswordField(props: Omit<InputFieldProps, 'type' | 'trailingItems'>) {
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
