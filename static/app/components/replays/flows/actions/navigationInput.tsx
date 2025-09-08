import {useState} from 'react';

import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import type {NavigationAction} from 'sentry/utils/replays/assertions/types';

export default function NavigationInput({
  disabled,
  initialAction,
  onChange,
}: {
  disabled: boolean;
  initialAction: null | NavigationAction;
  onChange: (action: NavigationAction) => void;
}) {
  const [value, setValue] = useState<string>(initialAction?.matcher.url ?? '');

  return (
    <Flex gap="xs" align="center" wrap="nowrap">
      <Text wrap="nowrap">{t('that matches')}</Text>
      <Input
        value={value}
        disabled={disabled}
        size="xs"
        placeholder={t('Search for an element')}
        onChange={e => {
          onChange({
            type: 'breadcrumb',
            category: 'navigation',
            matcher: {url: e.target.value},
          } as NavigationAction);
          setValue(e.target.value);
        }}
      />
    </Flex>
  );
}
