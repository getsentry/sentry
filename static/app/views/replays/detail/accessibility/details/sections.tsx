import {MouseEvent} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {
  keyValueTableOrNotFound,
  SectionItem,
} from 'sentry/views/replays/detail/accessibility/details/components';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

export type SectionProps = {
  item: SpanFrame;
  projectId: string;
  startTimestampMs: number;
};

export function GeneralSection({item, startTimestampMs}: SectionProps) {
  const {setCurrentTime} = useReplayContext();

  // TODO[replay]: what about:
  // `requestFrame?.data?.request?.size` vs. `requestFrame?.data?.requestBodySize`

  const data = {
    [t('Type')]: item.id,
    [t('Help')]: 'TODO',
    [t('Help URL')]: 'TODO',
    [t('Status')]: 'TODO',
    [t('Path')]: item.element,

    [t('Timestamp')]: (
      <TimestampButton
        format="mm:ss.SSS"
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          setCurrentTime(item.offsetMs);
        }}
        startTimestampMs={startTimestampMs}
        timestampMs={item.timestampMs}
      />
    ),
  };

  return (
    <SectionItem title={t('General')}>
      {keyValueTableOrNotFound(data, t('Missing request details'))}
    </SectionItem>
  );
}
