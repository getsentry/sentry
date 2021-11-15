import {useState} from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import CrashContent from 'app/components/events/interfaces/crashContent';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import {t} from 'app/locale';
import {ExceptionType, Group} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';
import {defined} from 'app/utils';

import {isStacktraceNewestFirst} from './utils';

type Props = {
  event: Event;
  type: string;
  data: ExceptionType;
  projectId: string;
  hasHierarchicalGrouping: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

function Exception({
  event,
  type,
  data,
  projectId,
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
    stackView?: STACK_VIEW;
    stackType?: STACK_TYPE;
    newestFirst?: boolean;
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
      type={type}
      title={<CrashTitle title={t('Exception')} {...commonCrashHeaderProps} />}
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
        projectId={projectId}
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

export default Exception;
