import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

type Props = {data: Frame; event: Event};

export function Template({data, event}: Props) {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.TEMPLATE);
  const meta = event._meta?.entries?.[entryIndex]?.data?.values;
  return (
    <FoldSection title={t('Template')} sectionKey={SectionKey.TEMPLATE}>
      <StackTraceViewStateProvider defaultView="full" platform={event.platform}>
        <StackTraceProvider
          event={event}
          stacktrace={{
            frames: [data],
            framesOmitted: null,
            hasSystemFrames: false,
            registers: null,
          }}
          meta={{frames: [meta]}}
        >
          <StackTraceFrames frameContextComponent={FrameContent} />
        </StackTraceProvider>
      </StackTraceViewStateProvider>
    </FoldSection>
  );
}
