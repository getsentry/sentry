import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {NativeStackTraceViewStateProvider} from 'sentry/components/stackTrace/native/nativeDisplayOptionsContext';
import {StackTraceFrameList} from 'sentry/components/stackTrace/stackTraceFrameList';
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
      <NativeStackTraceViewStateProvider defaultView="full" platform={event.platform}>
        <StackTraceFrameList
          event={event}
          stacktrace={{
            frames: [data],
            framesOmitted: null,
            hasSystemFrames: false,
            registers: null,
          }}
          meta={{frames: [meta]}}
          defaultExpandedFrameIndex={0}
          frameContextComponent={FrameContent}
        />
      </NativeStackTraceViewStateProvider>
    </FoldSection>
  );
}
