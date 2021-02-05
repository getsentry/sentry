import React from 'react';

import ActionButton from 'app/components/actions/button';
import {IconRefresh} from 'app/icons/iconRefresh';
import {t} from 'app/locale';
import {EntryException, EntryType, Event} from 'app/types/event';

import {isAppleCrashReportEvent, isMinidumpEvent, isNativeEvent} from './utils';

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

  // We want to show the reprocessing button if the issue in question is native or contains native frames.
  // The logic is taken from the symbolication pipeline in Python, where it is used to determine whether reprocessing
  // payloads should be stored:
  // https://github.com/getsentry/sentry/blob/cb7baef414890336881d67b7a8433ee47198c701/src/sentry/lang/native/processing.py#L425-L426
  // It is still not ideal as one can always merge native and non-native events together into one issue,
  // but it's the best approximation we have.
  if (
    !isMinidumpEvent(exceptionEntry) &&
    !isAppleCrashReportEvent(exceptionEntry) &&
    !isNativeEvent(event, exceptionEntry)
  ) {
    return null;
  }

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
