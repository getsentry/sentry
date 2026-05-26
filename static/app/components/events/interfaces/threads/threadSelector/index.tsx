import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOptionOrSection} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, ExceptionType, Frame, Thread} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getThreadInfo, type ThreadInfo} from './getThreadInfo';
import {Option} from './option';
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

export function ThreadSelector({
  threads,
  event,
  exception,
  activeThread,
  onChange,
}: Props) {
  const organization = useOrganization({allowNull: true});
  const [sortAttribute, setSortAttribute] = useState(SortAttribute.ID);
  const [isSortAscending, setIsSortAscending] = useState(true);

  const hasThreadStates = threads.some(thread =>
    defined(getMappedThreadState(thread.state))
  );

  const items = useMemo((): Array<SelectOptionOrSection<number>> => {
    const threadInfoMap = threads.reduce<Record<number, ThreadInfo>>((acc, thread) => {
      acc[thread.id] = getThreadInfo(event, thread, exception);
      return acc;
    }, {});

    const direction = isSortAscending ? 1 : -1;
    const sortedThreads = threads.toSorted((threadA, threadB) => {
      const threadInfoA = threadInfoMap[threadA.id] ?? {};
      const threadInfoB = threadInfoMap[threadB.id] ?? {};

      switch (sortAttribute) {
        case SortAttribute.ID:
          return direction * (threadA.id - threadB.id);
        case SortAttribute.NAME:
          return direction * (threadA.name?.localeCompare(threadB.name ?? '') ?? 0);
        case SortAttribute.LABEL:
          return (
            direction * (threadInfoA.label?.localeCompare(threadInfoB.label ?? '') ?? 0)
          );
        case SortAttribute.STATE:
          return (
            direction * (threadInfoA.state?.localeCompare(threadInfoB.state ?? '') ?? 0)
          );
        default:
          unreachable(sortAttribute);
          return 0;
      }
    });

    // Pin the active thread to the top of the list, preserving sort order for the rest.
    const currentThreadIndex = sortedThreads.findIndex(
      thread => thread.id === activeThread.id
    );
    if (currentThreadIndex > 0) {
      const [current] = sortedThreads.splice(currentThreadIndex, 1);
      sortedThreads.unshift(current!);
    }

    return sortedThreads.map(thread => {
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
  }, [
    threads,
    event,
    exception,
    sortAttribute,
    isSortAscending,
    activeThread,
    hasThreadStates,
  ]);

  const sortIcon = (
    <IconArrow
      direction={isSortAscending ? 'down' : 'up'}
      style={{height: 10, width: 10}}
    />
  );

  return (
    <CompactSelect
      data-test-id="thread-selector"
      search={{placeholder: t('Filter threads')}}
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
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} size="xs">
          <ThreadName>
            {t('Thread #%s: ', activeThread.id)}
            <ActiveThreadName>
              {activeThread.name
                ? activeThread.name
                : getThreadInfo(event, activeThread, exception).label ||
                  `<${t('unknown')}>`}
            </ActiveThreadName>
          </ThreadName>
        </OverlayTrigger.Button>
      )}
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
        }
      }}
    />
  );
}

const ThreadName = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const ActiveThreadName = styled('span')`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  max-width: 200px;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledGrid = styled(ThreadSelectorGrid)`
  padding-left: 36px;
  padding-right: 20px;
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  margin-bottom: ${p => p.theme.space.xs};
`;

const SortableThreadSelectorGridCell = styled(ThreadSelectorGridCell)`
  margin-bottom: ${p => p.theme.space.xs};
  cursor: pointer;
  user-select: none;
  border-radius: ${p => p.theme.radius.md};
  &:hover {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
  &:active {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const HeaderText = styled(Flex)`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${p => p.theme.space.xs};
  padding: 0 ${p => p.theme.space.xs};
`;
