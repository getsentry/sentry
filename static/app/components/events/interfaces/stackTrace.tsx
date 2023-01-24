import {useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import CrashContent from 'sentry/components/events/interfaces/crashContent';
import CrashActions from 'sentry/components/events/interfaces/crashHeader/crashActions';
import CrashTitle from 'sentry/components/events/interfaces/crashHeader/crashTitle';
import {t} from 'sentry/locale';
import {Group, Project} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';

import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = Pick<
  CrashContentProps,
  'groupingCurrentLevel' | 'hasHierarchicalGrouping'
> & {
  data: NonNullable<CrashContentProps['stacktrace']>;
  event: Event;
  projectSlug: Project['slug'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

export function StackTrace({
  hideGuide = false,
  projectSlug,
  event,
  data,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
}: Props) {
  const [stackView, setStackView] = useState<STACK_VIEW>(
    data.hasSystemFrames ? STACK_VIEW.APP : STACK_VIEW.FULL
  );
  const [newestFirst, setNewestFirst] = useState(isStacktraceNewestFirst());

  const stackTraceNotFound = !(data.frames ?? []).length;

  return (
    <EventDataSection
      type={EntryType.STACKTRACE}
      title={
        <CrashTitle
          title={t('Stack Trace')}
          hideGuide={hideGuide}
          newestFirst={newestFirst}
          onChange={
            !stackTraceNotFound ? value => setNewestFirst(value.newestFirst) : undefined
          }
        />
      }
      actions={
        !stackTraceNotFound && (
          <CrashActions
            stackView={stackView}
            platform={event.platform}
            stacktrace={data}
            hasHierarchicalGrouping={hasHierarchicalGrouping}
            onChange={value => setStackView(value.stackView ?? stackView)}
          />
        )
      }
      wrapTitle={false}
    >
      {stackTraceNotFound ? (
        <NoStackTraceMessage />
      ) : (
        <CrashContent
          projectSlug={projectSlug}
          event={event}
          stackView={stackView}
          newestFirst={newestFirst}
          stacktrace={data}
          stackType={STACK_TYPE.ORIGINAL}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      )}
    </EventDataSection>
  );
}
