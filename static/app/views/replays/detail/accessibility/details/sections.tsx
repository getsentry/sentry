import {MouseEvent} from 'react';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import type {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';
import {
  keyValueTableOrNotFound,
  KeyValueTuple,
  SectionItem,
} from 'sentry/views/replays/detail/accessibility/details/components';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

export type SectionProps = {
  item: HydratedA11yFrame;
  projectId: string;
  startTimestampMs: number;
};

export function ElementSection({item}: SectionProps) {
  return (
    <SectionItem title={t('DOM Element')}>
      <CodeSnippet language="html" hideCopyButton>
        {beautify.html(item.element.element, {indent_size: 2})}
      </CodeSnippet>
    </SectionItem>
  );
}

export function GeneralSection({item, startTimestampMs}: SectionProps) {
  const {setCurrentTime} = useReplayContext();

  const data: KeyValueTuple[] = [
    {
      key: t('Impact'),
      value: item.impact,
      type: item.impact === 'critical' ? 'warning' : undefined,
    },
    {key: t('Type'), value: item.id},
    {key: t('Help'), value: <a href={item.help_url}>{item.help}</a>},
    {key: t('Path'), value: item.element.target.join(' ')},
    {
      key: t('Timestamp'),
      value: (
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
    },
  ];

  return (
    <SectionItem title={t('General')}>
      {keyValueTableOrNotFound(data, t('Missing details'))}
    </SectionItem>
  );
}
