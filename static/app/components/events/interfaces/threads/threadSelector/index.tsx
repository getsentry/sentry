import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {Flex} from 'sentry/components/container/flex';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, ExceptionType, Frame, Thread} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import filterThreadInfo, {type ThreadInfo} from './filterThreadInfo';
import Option from './option';
import {ThreadSelectorGrid, ThreadSelectorGridCell} from './styles';
import {getMappedThreadState} from './threadStates';

type Props = {
  activeThread: Thread;
  event: Event;
  exception: Required<ExceptionType> | undefined;
  onChange: (thread: Thread) => void;
  /**
   * Expects threads to be sorted by crashed first
   */
  threads: readonly Thread[];
};

const enum SortAttribute {
  ID = 'id',
  NAME = 'name',
  LABEL = 'label',
  STATE = 'state',
}

function getThreadLabel(
  details: ReturnType<typeof filterThreadInfo>,
  name: string | null | undefined
) {
  if (name?.length) {
    return name;
  }

  return details?.label || `<${t('unknown')}>`;
}

function ThreadSelector({threads, event, exception, activeThread, onChange}: Props) {
  const organization = useOrganization({allowNull: true});
  const [currentThread, setCurrentThread] = useState<Thread>(activeThread);
  const [sortAttribute, setSortAttribute] = useState<SortAttribute>(SortAttribute.ID);
  const [isSortAscending, setIsSortAscending] = useState<boolean>(true);

  const hasThreadStates = threads.some(thread =>
    defined(getMappedThreadState(thread.state))
  );
  const threadInfoMap = useMemo(() => {
    return threads.reduce<Record<number, ThreadInfo>>((acc, thread) => {
      acc[thread.id] = filterThreadInfo(event, thread, exception);
      return acc;
    }, {});
  }, [threads, event, exception]);

  const orderedThreads = useMemo(() => {
    const sortedThreads: readonly Thread[] = threads.toSorted((threadA, threadB) => {
      const threadInfoA = threadInfoMap[threadA.id] ?? {};
      const threadInfoB = threadInfoMap[threadB.id] ?? {};

      switch (sortAttribute) {
        case SortAttribute.ID:
          return isSortAscending ? threadA.id - threadB.id : threadB.id - threadA.id;
        case SortAttribute.NAME:
          return isSortAscending
            ? threadA.name?.localeCompare(threadB.name ?? '') ?? 0
            : threadB.name?.localeCompare(threadA.name ?? '') ?? 0;
        case SortAttribute.LABEL:
          return isSortAscending
            ? threadInfoA.label?.localeCompare(threadInfoB.label ?? '') ?? 0
            : threadInfoB.label?.localeCompare(threadInfoA.label ?? '') ?? 0;
        case SortAttribute.STATE:
          return isSortAscending
            ? threadInfoA.state?.localeCompare(threadInfoB.state ?? '') ?? 0
            : threadInfoB.state?.localeCompare(threadInfoA.state ?? '') ?? 0;
        default:
          return 0;
      }
    });
    const currentThreadIndex = sortedThreads.findIndex(
      thread => thread.id === currentThread.id
    );
    return [
      sortedThreads[currentThreadIndex],
      ...sortedThreads.slice(0, currentThreadIndex),
      ...sortedThreads.slice(currentThreadIndex + 1),
    ].filter(defined);
  }, [threads, sortAttribute, isSortAscending, currentThread, threadInfoMap]);

  const items = orderedThreads.map((thread: Thread) => {
    const threadInfo = threadInfoMap[thread.id] ?? {};
    return {
      value: thread.id,
      textValue: `#${thread.id}: ${thread.name ?? ''} ${threadInfo.label ?? ''} ${threadInfo.filename ?? ''} ${threadInfo.state ?? ''}`,
      label: (
        <Option
          thread={thread}
          details={threadInfo}
          crashedInfo={threadInfo?.crashedInfo}
          hasThreadStates={hasThreadStates}
        />
      ),
    };
  });

  const sortIcon = (
    <IconArrow
      direction={isSortAscending ? 'down' : 'up'}
      style={{height: 10, width: 10}}
    />
  );

  return (
    <CompactSelect
      data-test-id="thread-selector"
      searchable
      searchPlaceholder={t('Filter threads')}
      onOpenChange={() => {
        trackAnalytics('stack_trace.threads.thread_selector_opened', {
          organization,
          platform: event.platform,
          num_threads: items.length,
        });
      }}
      value={activeThread.id}
      options={items}
      menuWidth={450}
      triggerProps={{size: 'xs'}}
      triggerLabel={
        <ThreadName>
          {t('Thread #%s: ', activeThread.id)}
          <ActiveThreadName>
            {getThreadLabel(
              filterThreadInfo(event, activeThread, exception),
              activeThread.name
            )}
          </ActiveThreadName>
        </ThreadName>
      }
      menuBody={
        <StyledGrid hasThreadStates={hasThreadStates}>
          <ThreadSelectorGridCell />
          <SortableThreadSelectorGridCell
            onClick={() => {
              setSortAttribute(SortAttribute.ID);
              setIsSortAscending(
                sortAttribute === SortAttribute.ID ? !isSortAscending : true
              );
            }}
          >
            <HeaderText>
              {t('ID')}
              {sortAttribute === SortAttribute.ID && sortIcon}
            </HeaderText>
          </SortableThreadSelectorGridCell>
          <SortableThreadSelectorGridCell
            onClick={() => {
              setSortAttribute(SortAttribute.NAME);
              setIsSortAscending(
                sortAttribute === SortAttribute.NAME ? !isSortAscending : true
              );
            }}
          >
            <HeaderText>
              {t('Name')}
              {sortAttribute === SortAttribute.NAME && sortIcon}
            </HeaderText>
          </SortableThreadSelectorGridCell>
          <SortableThreadSelectorGridCell
            onClick={() => {
              setSortAttribute(SortAttribute.LABEL);
              setIsSortAscending(
                sortAttribute === SortAttribute.LABEL ? !isSortAscending : true
              );
            }}
          >
            <HeaderText>
              {t('Label')}
              {sortAttribute === SortAttribute.LABEL && sortIcon}
            </HeaderText>
          </SortableThreadSelectorGridCell>
          {hasThreadStates && (
            <SortableThreadSelectorGridCell
              onClick={() => {
                setSortAttribute(SortAttribute.STATE);
                setIsSortAscending(
                  sortAttribute === SortAttribute.STATE ? !isSortAscending : true
                );
              }}
            >
              <HeaderText>
                {t('State')}
                {sortAttribute === SortAttribute.STATE && sortIcon}
              </HeaderText>
            </SortableThreadSelectorGridCell>
          )}
        </StyledGrid>
      }
      onChange={selected => {
        const threadIndex = threads.findIndex(th => th.id === selected.value);
        const thread = threads[threadIndex];
        if (thread) {
          trackAnalytics('stack_trace.threads.thread_selected', {
            organization,
            platform: event.platform,
            thread_index: threadIndex,
            num_threads: items.length,
            is_crashed_thread: thread.crashed,
            is_current_thread: thread.current,
            thread_state: thread.state ?? '',
            has_stacktrace: defined(thread.stacktrace),
            num_in_app_frames:
              thread.stacktrace?.frames?.filter((frame: Frame) => frame.inApp).length ??
              0,
          });
          onChange(thread);
          setCurrentThread(thread);
        }
      }}
    />
  );
}

export default ThreadSelector;

const ThreadName = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const ActiveThreadName = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
  max-width: 200px;
  ${p => p.theme.overflowEllipsis};
`;

const StyledGrid = styled(ThreadSelectorGrid)`
  padding-left: 36px;
  padding-right: 20px;
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(0.5)};
`;

const SortableThreadSelectorGridCell = styled(ThreadSelectorGridCell)`
  margin-bottom: ${space(0.5)};
  cursor: pointer;
  user-select: none;
  border-radius: ${p => p.theme.borderRadius};
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const HeaderText = styled(Flex)`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${space(0.5)};
  padding: 0 ${space(0.5)};
`;
