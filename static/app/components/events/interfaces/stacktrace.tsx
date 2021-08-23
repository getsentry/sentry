import {useState} from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import CrashContent from 'app/components/events/interfaces/crashContent';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import {Group, Project} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';

import NoStackTraceMessage from './noStackTraceMessage';

export function isStacktraceNewestFirst() {
  const user = ConfigStore.get('user');
  // user may not be authenticated

  if (!user) {
    return true;
  }

  switch (user.options.stacktraceOrder) {
    case 2:
      return true;
    case 1:
      return false;
    case -1:
    default:
      return true;
  }
}

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = Pick<
  CrashContentProps,
  'groupingCurrentLevel' | 'hasHierarchicalGrouping'
> & {
  event: Event;
  type: string;
  data: NonNullable<CrashContentProps['stacktrace']>;
  projectId: Project['id'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

function StacktraceInterface({
  hideGuide = false,
  projectId,
  event,
  data,
  type,
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
      type={type}
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
          projectId={projectId}
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

export default StacktraceInterface;
