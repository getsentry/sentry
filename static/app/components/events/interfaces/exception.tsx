import {useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import CrashContent from 'sentry/components/events/interfaces/crashContent';
import CrashActions from 'sentry/components/events/interfaces/crashHeader/crashActions';
import CrashTitle from 'sentry/components/events/interfaces/crashHeader/crashTitle';
import {t} from 'sentry/locale';
import {ExceptionType, Group} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import {isStacktraceNewestFirst} from './utils';

type Props = {
  data: ExceptionType;
  event: Event;
  hasHierarchicalGrouping: boolean;
  projectSlug: string;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

export function Exception({
  event,
  data,
  projectSlug,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
  hideGuide = false,
}: Props) {
  const [stackView, setStackView] = useState<STACK_VIEW>(
    data.hasSystemFrames ? STACK_VIEW.APP : STACK_VIEW.FULL
  );
  const [stackType, setStackType] = useState<STACK_TYPE>(STACK_TYPE.ORIGINAL);
  const [newestFirst, setNewestFirst] = useState(isStacktraceNewestFirst());

  const eventHasThreads = !!event.entries.find(entry => entry.type === 'threads');

  /* in case there are threads in the event data, we don't render the
   exception block.  Instead the exception is contained within the
   thread interface. */
  if (eventHasThreads) {
    return null;
  }

  function handleChange({
    stackView: newStackView,
    stackType: newStackType,
    newestFirst: newNewestFirst,
  }: {
    newestFirst?: boolean;
    stackType?: STACK_TYPE;
    stackView?: STACK_VIEW;
  }) {
    if (newStackView) {
      setStackView(newStackView);
    }

    if (defined(newNewestFirst)) {
      setNewestFirst(newNewestFirst);
    }

    if (newStackType) {
      setStackType(newStackType);
    }
  }

  const commonCrashHeaderProps = {
    newestFirst,
    hideGuide,
    onChange: handleChange,
  };

  return (
    <EventDataSection
      type={EntryType.EXCEPTION}
      title={<CrashTitle title={t('Stack Trace')} {...commonCrashHeaderProps} />}
      actions={
        <CrashActions
          stackType={stackType}
          stackView={stackView}
          platform={event.platform}
          exception={data}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          {...commonCrashHeaderProps}
        />
      }
      wrapTitle={false}
    >
      <CrashContent
        projectSlug={projectSlug}
        event={event}
        stackType={stackType}
        stackView={stackView}
        newestFirst={newestFirst}
        exception={data}
        groupingCurrentLevel={groupingCurrentLevel}
        hasHierarchicalGrouping={hasHierarchicalGrouping}
      />
    </EventDataSection>
  );
}
