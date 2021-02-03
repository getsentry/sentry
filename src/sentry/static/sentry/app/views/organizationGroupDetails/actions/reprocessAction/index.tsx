import React from 'react';

import ActionButton from 'app/components/actions/button';
import {IconRefresh} from 'app/icons/iconRefresh';
import {t} from 'app/locale';
import {EntryException, EntryType, Event} from 'app/types/event';

import {isNativeEvent} from './utils';

type Props = {
  disabled: boolean;
  onClick: (event: React.MouseEvent) => void;
  event?: Event;
};

function ReprocessAction({event, disabled, onClick}: Props) {
  if (!event) {
    return null;
  }

  const {entries} = event;
  const exceptionEntry = entries.find(entry => entry.type === EntryType.EXCEPTION) as
    | EntryException
    | undefined;

  if (!exceptionEntry) {
    return null;
  }

  isNativeEvent(event, exceptionEntry);

  return (
    <ActionButton
      disabled={disabled}
      icon={<IconRefresh size="xs" />}
      title={t('Reprocess this issue')}
      label={t('Reprocess this issue')}
      onClick={onClick}
    />
  );
}

export default ReprocessAction;
