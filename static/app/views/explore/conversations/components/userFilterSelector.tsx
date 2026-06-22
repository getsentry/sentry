import {parseAsString, useQueryState} from 'nuqs';

import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';

export const USER_FILTER_PARAM = 'userFilter';

export type UserFilterValue = '' | 'has_user' | 'no_user';

const OPTIONS: Array<{label: string; value: UserFilterValue}> = [
  {value: '', label: t('All')},
  {value: 'has_user', label: t('Has user')},
  {value: 'no_user', label: t('No user')},
];

export function UserFilterSelector() {
  const [value, setValue] = useQueryState(
    USER_FILTER_PARAM,
    parseAsString.withDefault('').withOptions({history: 'replace'})
  );

  return (
    <CompactSelect
      value={value}
      options={OPTIONS}
      menuTitle={t('User')}
      menuHeaderTrailingItems={
        value ? <MenuComponents.ResetButton onClick={() => setValue(null)} /> : null
      }
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('User')} />
      )}
      onChange={option => {
        setValue(option.value || null);
      }}
    />
  );
}
