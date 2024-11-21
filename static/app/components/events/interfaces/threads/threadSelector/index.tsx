import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, ExceptionType, Frame, Thread} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import filterThreadInfo from './filterThreadInfo';
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
  threads: Thread[];
};

function Header({hasThreadStates}: {hasThreadStates: boolean}) {
  return (
    <StyledGrid hasThreadStates={hasThreadStates}>
      <ThreadSelectorGridCell />
      <ThreadSelectorGridCell>{t('ID')}</ThreadSelectorGridCell>
      <ThreadSelectorGridCell>{t('Name')}</ThreadSelectorGridCell>
      <ThreadSelectorGridCell>{t('Label')}</ThreadSelectorGridCell>
      {hasThreadStates && <ThreadSelectorGridCell>{t('State')}</ThreadSelectorGridCell>}
    </StyledGrid>
  );
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

  const hasThreadStates = threads.some(thread =>
    defined(getMappedThreadState(thread.state))
  );

  const items = useMemo(() => {
    return threads.map((thread: Thread) => {
      const threadInfo = filterThreadInfo(event, thread, exception);
      return {
        value: thread.id,
        textValue: `#${thread.id}: ${thread.name} ${threadInfo.label} ${threadInfo.filename}`,
        label: (
          <Option
            thread={thread}
            details={threadInfo}
            crashedInfo={threadInfo.crashedInfo}
            hasThreadStates={hasThreadStates}
          />
        ),
      };
    });
  }, [threads, event, exception, hasThreadStates]);

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
      menuBody={<Header hasThreadStates={hasThreadStates} />}
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
  padding-left: 40px;
  padding-right: 40px;
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: 2px;
`;
