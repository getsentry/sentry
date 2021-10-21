import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import isNil from 'lodash/isNil';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import EventDataSection from 'app/components/events/eventDataSection';
import CrashContent from 'app/components/events/interfaces/crashContent';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import Pill from 'app/components/pill';
import Pills from 'app/components/pills';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Project} from 'app/types';
import {Event} from 'app/types/event';
import {Thread} from 'app/types/events';
import {STACK_TYPE} from 'app/types/stacktrace';
import {defined} from 'app/utils';
import BooleanField from 'app/views/settings/components/forms/booleanField';

import NoStackTraceMessage from '../../noStackTraceMessage';
import ThreadSelector from '../threadSelector';
import findBestThread from '../threadSelector/findBestThread';
import getThreadException from '../threadSelector/getThreadException';
import getThreadStacktrace from '../threadSelector/getThreadStacktrace';

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = {
  event: Event;
  projectId: Project['id'];
  type: string;
  data: {
    values?: Array<Thread>;
  };
  hideGuide?: boolean;
} & Pick<CrashContentProps, 'hasHierarchicalGrouping' | 'groupingCurrentLevel'>;

type State = {
  stackType: STACK_TYPE;
  newestFirst: boolean;
  activeThread?: Thread;
  rawStackTrace: boolean;
};

function Threads({
  event,
  projectId,
  type,
  data,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  hideGuide = false,
}: Props) {
  const [state, setState] = useState<State>(() => {
    const thread = defined(data.values) ? findBestThread(data.values) : undefined;
    return {
      activeThread: thread,
      stackType: STACK_TYPE.ORIGINAL,
      newestFirst: isStacktraceNewestFirst(),
      rawStackTrace: false,
    };
  });

  function handleChangeNewestFirst({newestFirst}: Pick<State, 'newestFirst'>) {
    setState({...state, newestFirst});
  }

  function handleSelectNewThread(thread: Thread) {
    setState({
      ...state,
      activeThread: thread,
      stackType: STACK_TYPE.ORIGINAL,
    });
  }

  const threads = data.values ?? [];
  const {rawStackTrace, stackType, newestFirst, activeThread} = state;

  const exception = getThreadException(event, activeThread);

  const stacktrace = !exception
    ? getThreadStacktrace(stackType !== STACK_TYPE.ORIGINAL, activeThread)
    : undefined;

  const stackTraceNotFound = !(exception || stacktrace);
  const hasMoreThanOneThread = threads.length > 1;

  return (
    <EventDataSection
      type={type}
      title={
        hasMoreThanOneThread ? (
          <CrashTitle
            title=""
            newestFirst={newestFirst}
            hideGuide={hideGuide}
            onChange={handleChangeNewestFirst}
            beforeTitle={
              activeThread && (
                <ThreadSelector
                  threads={threads}
                  activeThread={activeThread}
                  event={event}
                  onChange={handleSelectNewThread}
                  exception={exception}
                />
              )
            }
          />
        ) : (
          <CrashTitle
            title={t('Stack Trace')}
            newestFirst={newestFirst}
            hideGuide={hideGuide}
            onChange={!stackTraceNotFound ? handleChangeNewestFirst : undefined}
          />
        )
      }
      actions={
        <RawToggler
          name="raw-stack-trace"
          label={t('Raw')}
          hideControlState
          value={rawStackTrace}
          onChange={() => setState({...state, rawStackTrace: !rawStackTrace})}
        />
      }
      showPermalink={!hasMoreThanOneThread}
      wrapTitle={false}
    >
      <Fragment>
        <div>
          <DropdownControl buttonProps={{prefix: t('Sort By')}} label={activeSort.label}>
            {SORT_OPTIONS.map(({label, value}) => (
              <DropdownItem
                key={value}
                onSelect={this.handleSortChange}
                eventKey={value}
                isActive={value === activeSort.value}
              >
                {label}
              </DropdownItem>
            ))}
          </DropdownControl>
        </div>
        {activeThread && (!isNil(activeThread?.id) || !!activeThread?.name) && (
          <Pills>
            {!isNil(activeThread.id) && (
              <Pill name={t('id')} value={String(activeThread.id)} />
            )}
            {!!activeThread.name?.trim() && (
              <Pill name={t('name')} value={activeThread.name} />
            )}
            <Pill name={t('was active')} value={activeThread.current} />
            <Pill name={t('errored')} className={activeThread.crashed ? 'false' : 'true'}>
              {activeThread.crashed ? t('yes') : t('no')}
            </Pill>
          </Pills>
        )}
        {stackTraceNotFound ? (
          <NoStackTraceMessage
            message={activeThread?.crashed ? t('Thread Errored') : undefined}
          />
        ) : (
          <CrashContent
            event={event}
            stackType={stackType}
            stackView={undefined}
            newestFirst={newestFirst}
            projectId={projectId}
            exception={exception}
            stacktrace={stacktrace}
            groupingCurrentLevel={groupingCurrentLevel}
            hasHierarchicalGrouping={hasHierarchicalGrouping}
          />
        )}
      </Fragment>
    </EventDataSection>
  );
}

export default Threads;

const RawToggler = styled(BooleanField)`
  padding: 0;
  display: grid;
  grid-template-columns: auto max-content;
  grid-gap: ${space(1)};

  && {
    > * {
      padding: 0;
      width: auto;
    }
  }
`;
