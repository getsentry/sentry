import {useCallback} from 'react';
import {parseAsBoolean, useQueryState} from 'nuqs';

import {Flex} from '@sentry/scraps/layout';

import {Switch} from 'sentry/components/core/switch';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {hasGenAiConversationsFeature} from 'sentry/views/insights/pages/agents/utils/features';

export function ConversationsTableSwitch() {
  const {value, onChange} = useConversationsTableSwitch();
  const organization = useOrganization();
  const showSwitch = hasGenAiConversationsFeature(organization);

  if (!showSwitch) {
    return null;
  }

  return (
    <Flex gap="md">
      <div>{t('Show conversations')}</div>
      <Switch checked={!!value} onChange={onChange} />
    </Flex>
  );
}

export function useConversationsTableSwitch() {
  const [value, setValue] = useQueryState(
    'conversationTable',
    parseAsBoolean.withDefault(false)
  );

  const handleChange = useCallback(() => {
    setValue(prev => !prev);
  }, [setValue]);

  return {
    value,
    onChange: handleChange,
  };
}
