import {useState} from 'react';
import {IconHide} from '@sentry/icons/hide';
import {IconShow} from '@sentry/icons/show';
import type {DistributedOmit} from 'type-fest';

import {Button} from '@sentry/scraps/button';
import {InputField} from '@sentry/scraps/form/field/inputField';
import type {FieldWithValue} from '@sentry/scraps/form/formHelpers';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import type {InputFieldProps} from './inputField';

export function PasswordField(
  props: DistributedOmit<InputFieldProps, 'type' | 'trailingItems'> & {
    field: FieldWithValue<unknown>;
  }
) {
  const [isFieldVisible, setisFieldVisible] = useState(false);
  const {t} = useTranslation();

  return (
    <InputField
      {...props}
      type={isFieldVisible ? 'text' : 'password'}
      trailingItems={
        <Button
          size="xs"
          variant="transparent"
          icon={isFieldVisible ? <IconShow size="xs" /> : <IconHide size="xs" />}
          aria-label={isFieldVisible ? t('Hide password') : t('Show password')}
          onClick={() => setisFieldVisible(v => !v)}
        />
      }
    />
  );
}
